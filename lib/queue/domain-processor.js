/**
 * Per-Domain Sequential Processor (Dual Database Version)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Import both clients
import { prisma, prismaSupabase } from '../db.js'
import { analyzeDomain } from '../crawler/domain-analyzer.js'
import { crawlPages } from '../crawler/page-crawler.js'
import { submitForm } from '../automation/form-submitter.js'
import { submitComment } from '../automation/comment-submitter.js'
import { logInfo, logSuccess, logWarning, logError, logStep } from '../campaign-logger.js'
import { submitFormWithRetry, submitCommentWithRetry } from '../utils/retry.js'

/**
 * Process the next available domain from ANY database
 */
export async function processNextDomain(retryCount = 0) {
    if (retryCount > 6) return false // Prevent infinite loops

    // Try Local (SQLite) first
    // we use a localized retry count for internal logic
    const localResult = await processNextDomainInDb(prisma, retryCount, 'SQLITE')
    if (localResult) return true

    // Try Cloud (Supabase) second
    const cloudResult = await processNextDomainInDb(prismaSupabase, retryCount, 'SUPABASE')
    if (cloudResult) return true

    return false
}

/**
 * Process logic for a specific DB instance
 */
async function processNextDomainInDb(db, retryCount, dbName) {
    // Skip based on retry count logic?
    // We can simplify: always try to find one.
    // If retryCount is high, we might want to back off.

    let pendingDomain = null
    try {
        pendingDomain = await db.domain.findFirst({
            where: {
                status: 'PENDING',
                campaign: {
                    status: 'RUNNING'
                }
            },
            // Simple skip logic if retries are happening, to avoid sticking on one broken domain
            skip: retryCount > 0 ? retryCount : 0,
            orderBy: [
                { createdAt: 'asc' },
                { id: 'asc' }
            ]
        })
    } catch (error) {
        // Handle locking or connection errors
        // If DB is busy, just return false (continue to next DB or retry)
        return false
    }

    if (!pendingDomain) {
        // If we skipped, try without skip
        if (retryCount > 0) return processNextDomainInDb(db, 0, dbName)
        return false
    }

    // ATOMIC CLAIM
    const claimResult = await db.domain.updateMany({
        where: {
            id: pendingDomain.id,
            status: 'PENDING'
        },
        data: {
            status: 'PROCESSING'
        }
    })

    if (claimResult.count === 0) {
        // Already claimed
        return processNextDomainInDb(db, retryCount + 1, dbName)
    }

    // Re-fetch with campaign
    const domain = await db.domain.findUnique({
        where: { id: pendingDomain.id },
        include: { campaign: true }
    })

    if (!domain) return false

    // pass 'db' to loggers
    await logInfo(domain.campaignId, `🌐 [${dbName}] Processing domain: ${domain.url}`, domain.id, db)

    try {
        // Parse config
        let config = {}
        try {
            if (domain.campaign.config) {
                config = JSON.parse(domain.campaign.config)
            }
        } catch (e) { }

        // === STEP 1: Analyze ===
        await logStep(domain.campaignId, `Step 1: Analyzing...`, domain.id, db)
        const analysis = await analyzeDomain(domain.url)

        await db.domain.update({
            where: { id: domain.id },
            data: {
                hasRobotsTxt: !!analysis.robotsTxt,
                robotsTxtContent: analysis.robotsTxt,
                sitemapsFound: analysis.sitemaps.length,
            }
        })

        // === STEP 2: Crawl ===
        await logStep(domain.campaignId, `Step 2: Crawling...`, domain.id, db)
        const initialUrls = analysis.urls || []

        const pages = await crawlPages(domain.url, {
            maxPages: config.maxPages || 20,
            robots: analysis.robots,
            initialUrls: initialUrls,
            onProgress: async (msg, current, total) => {
                if (current % 5 === 0) await logInfo(domain.campaignId, `Crawl: ${current}/${total}`, domain.id, db)
            }
        })

        await logSuccess(domain.campaignId, `Found ${pages.length} pages`, domain.id, db)

        // Save pages
        let formsCount = 0
        let commentsCount = 0
        const savedPages = []

        for (const page of pages) {
            const existingPage = await db.pageDiscovery.findFirst({
                where: {
                    campaignId: domain.campaignId,
                    domainId: domain.id,
                    url: page.url
                }
            })

            const pageData = {
                title: page.title || 'Untitled',
                hasForm: page.forms?.length > 0 || page.hasForm || false,
                hasComments: page.comments?.length > 0 || page.hasComments || false,
                formFields: page.forms?.[0] ? JSON.stringify(page.forms[0]) : null,
                commentFields: page.comments?.[0] ? JSON.stringify(page.comments[0]) : null,
            }

            let savedPage
            if (existingPage) {
                savedPage = await db.pageDiscovery.update({
                    where: { id: existingPage.id },
                    data: pageData
                })
            } else {
                savedPage = await db.pageDiscovery.create({
                    data: {
                        campaignId: domain.campaignId,
                        domainId: domain.id,
                        url: page.url,
                        ...pageData
                    }
                })
            }
            savedPages.push({ ...savedPage, originalPage: page })

            if (page.forms?.length > 0 || page.hasForm) formsCount++
            if (page.comments?.length > 0 || page.hasComments) commentsCount++

            if ((page.contacts?.email || page.contacts?.phone) && config.extractEmails !== false) {
                await db.extractedContact.upsert({
                    where: {
                        campaignId_domainId: {
                            campaignId: domain.campaignId,
                            domainId: domain.id,
                        }
                    },
                    create: {
                        campaignId: domain.campaignId,
                        domainId: domain.id,
                        email: page.contacts.email || null,
                        phone: page.contacts.phone || null,
                        extractedFrom: page.url,
                    },
                    update: {
                        email: page.contacts.email || undefined,
                        phone: page.contacts.phone || undefined,
                        extractedFrom: page.url,
                    }
                })
            }
        }

        // === STEP 3: Submit ===
        const targetForms = (config.targetFormsCount && config.targetFormsCount > 0) ? config.targetFormsCount : formsCount

        let totalFormsSubmitted = 0
        let totalFormsFailed = 0

        if (domain.campaign.submitForms && formsCount > 0) {
            await logStep(domain.campaignId, `Step 3: Submitting forms...`, domain.id, db)

            for (const savedPage of savedPages) {
                if (totalFormsSubmitted >= targetForms) continue
                const hasFormOnPage = savedPage.hasForm || savedPage.originalPage?.forms?.length > 0
                if (!hasFormOnPage) continue

                try {
                    const formData = savedPage.originalPage?.forms?.[0] || null
                    const result = await submitFormWithRetry(
                        submitForm,
                        savedPage.url,
                        formData,
                        {
                            name: domain.campaign.senderName || 'Anonymous',
                            email: domain.campaign.senderEmail || 'contact@example.com',
                            message: domain.campaign.messageTemplate || 'Hello!',
                        },
                        {
                            screenshots: config.saveScreenshots !== false,
                            skipDuplicates: config.skipDuplicates !== false,
                            campaignId: domain.campaignId,
                            freshFingerprint: true,
                        }
                    )

                    await db.submissionLog.create({
                        data: {
                            campaignId: domain.campaignId,
                            pageId: savedPage.id,
                            type: 'FORM',
                            status: result.success ? 'SUCCESS' : 'FAILED',
                            responseMessage: result.message,
                            screenshotUrl: result.screenshots?.after?.path || null,
                        }
                    })

                    if (result.success) totalFormsSubmitted++
                    else totalFormsFailed++

                } catch (e) {
                    totalFormsFailed++
                }
            }
        }

        // === STEP 4: Comments ===
        const targetComments = (config.targetCommentsCount && config.targetCommentsCount > 0) ? config.targetCommentsCount : commentsCount

        if (domain.campaign.submitComments && commentsCount > 0) {
            let submitted = 0
            for (const savedPage of savedPages) {
                if (submitted >= targetComments) continue
                const hasComments = savedPage.hasComments || savedPage.originalPage?.comments?.length > 0
                if (!hasComments) continue

                try {
                    const result = await submitCommentWithRetry(
                        submitComment,
                        savedPage.url,
                        savedPage.originalPage?.comments?.[0] || null,
                        {
                            name: domain.campaign.senderName || 'Anonymous',
                            email: domain.campaign.senderEmail || 'contact@example.com',
                            message: domain.campaign.messageTemplate || 'Comment',
                        }
                    )
                    await db.submissionLog.create({
                        data: {
                            campaignId: domain.campaignId,
                            pageId: savedPage.id,
                            type: 'COMMENT',
                            status: result.success ? 'SUCCESS' : 'FAILED',
                            responseMessage: result.message,
                        }
                    })
                    submitted++
                } catch (e) { }
            }
        }

        // === COMPLETE ===
        let finalStatus = 'COMPLETED'
        let failureReason = null
        if (domain.campaign.submitForms && formsCount > 0 && totalFormsSubmitted === 0 && totalFormsFailed > 0) {
            finalStatus = 'FAILED'
            failureReason = 'All form submissions failed'
        }

        await db.domain.update({
            where: { id: domain.id },
            data: {
                status: finalStatus,
                pagesDiscovered: pages.length,
                errorMessage: failureReason
            }
        })

        await logSuccess(domain.campaignId, `Domain complete: ${domain.url}`, domain.id, db)

        // Check if campaign complete
        const pendingDomains = await db.domain.count({
            where: {
                campaignId: domain.campaignId,
                status: { in: ['PENDING', 'PROCESSING'] }
            }
        })

        if (pendingDomains === 0) {
            await db.campaign.update({
                where: { id: domain.campaignId },
                data: { status: 'COMPLETED' }
            })
            await logSuccess(domain.campaignId, `🎉 Campaign COMPLETED!`, null, db)
        }

        return true

    } catch (error) {
        await logError(domain.campaignId, `Failed: ${error.message}`, domain.id, db)
        await db.domain.update({
            where: { id: domain.id },
            data: { status: 'FAILED', errorMessage: error.message }
        })
        return true
    }
}

export async function resetStuckDomains() {
    await resetStuckDomainsInDb(prisma, 'SQLITE')
    await resetStuckDomainsInDb(prismaSupabase, 'SUPABASE')
}

async function resetStuckDomainsInDb(db, name) {
    try {
        const stuck = await db.domain.updateMany({
            where: {
                status: 'PROCESSING',
                updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) }
            },
            data: { status: 'PENDING' }
        })
        if (stuck.count > 0) console.log(`[${name}] Reset ${stuck.count} stuck domains`)
    } catch (e) {
        console.error(`[${name}] Failed to reset stuck:`, e.message)
    }
}
