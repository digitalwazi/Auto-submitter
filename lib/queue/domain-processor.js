/**
 * Per-Domain Sequential Processor
 * 
 * This processor handles one domain completely before moving to the next:
 * Analyze → Crawl Pages → Submit Forms/Comments → DONE → Next Domain
 * 
 * Multiple instances can run in parallel for faster processing.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import prisma from '../db.js'
import { analyzeDomain } from '../crawler/domain-analyzer.js'
import { crawlPages } from '../crawler/page-crawler.js'
import { submitForm } from '../automation/form-submitter.js'
import { submitComment } from '../automation/comment-submitter.js'
import { logInfo, logSuccess, logWarning, logError, logStep } from '../campaign-logger.js'

/**
 * Process the next available domain completely (sequential steps)
 * Returns true if a domain was processed, false if no domains available
 */
export async function processNextDomain(retryCount = 0) {
    if (retryCount > 3) return false // Prevent infinite loops

    // ATOMIC CLAIM: Find and claim a domain in one operation to prevent race conditions
    // Use updateMany with a unique worker ID to atomically claim a domain
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // First, find a pending domain from a running campaign
    // Deterministic skip based on retry count to cascade through the list sequentially
    const skip = retryCount

    let pendingDomain = null
    try {
        pendingDomain = await prisma.domain.findFirst({
            where: {
                status: 'PENDING',
                campaign: {
                    status: 'RUNNING'
                }
            },
            skip: skip,
            orderBy: [
                { createdAt: 'asc' },
                { id: 'asc' }
            ]
        })
    } catch (error) {
        if (error.code === 'P2024' || error.message.includes('Busy') || error.message.includes('locked')) {
            console.log(`⚠️ DB Locked (Worker ${retryCount}), retrying in 200ms...`)
            await new Promise(r => setTimeout(r, 200))
            return processNextDomain(retryCount) // Retry same count
        }
        throw error
    }

    if (!pendingDomain) {
        // If we skipped and found nothing, try without skip before giving up
        if (skip > 0) {
            return processNextDomain(retryCount + 1)
        }
        return false // No domains to process
    }

    // ATOMIC CLAIM: Only update if still PENDING (prevents race condition)
    const claimResult = await prisma.domain.updateMany({
        where: {
            id: pendingDomain.id,
            status: 'PENDING' // Only claim if still pending
        },
        data: {
            status: 'PROCESSING'
        }
    })

    // If no rows updated, another worker already claimed this domain
    if (claimResult.count === 0) {
        console.log(`⚠️ Domain ${pendingDomain.url} already claimed by another worker`)
        // Retry with recursion to find another domain
        // Pass incremented retry count
        return processNextDomain(retryCount + 1)
    }

    // Re-fetch the domain with campaign data
    const domain = await prisma.domain.findUnique({
        where: { id: pendingDomain.id },
        include: { campaign: true }
    })

    if (!domain) {
        return processNextDomain(retryCount + 1)
    }

    await logInfo(domain.campaignId, `🌐 Processing domain: ${domain.url}`, domain.id)

    try {
        // Parse campaign config
        let config = {}
        try {
            if (domain.campaign.config) {
                config = JSON.parse(domain.campaign.config)
            }
        } catch (e) { }

        // === STEP 1: Analyze Domain ===
        await logStep(domain.campaignId, `Step 1: Analyzing domain ${domain.url}...`, domain.id)
        const analysis = await analyzeDomain(domain.url)

        await prisma.domain.update({
            where: { id: domain.id },
            data: {
                hasRobotsTxt: !!analysis.robotsTxt,
                robotsTxtContent: analysis.robotsTxt,
                sitemapsFound: analysis.sitemaps.length,
            }
        })

        // === STEP 2: Crawl Pages ===
        await logStep(domain.campaignId, `Step 2: Crawling pages (max ${config.maxPages || 20})...`, domain.id)

        // Use URLs extracted from sitemaps as initial crawl queue
        const initialUrls = analysis.urls || []
        await logInfo(domain.campaignId, `Starting with ${initialUrls.length} URLs from sitemaps`, domain.id)

        const pages = await crawlPages(domain.url, {
            maxPages: config.maxPages || 20,
            robots: analysis.robots, // Pass the robots parser for compliance
            initialUrls: initialUrls,
            // Log progress every 5 pages to avoid spamming
            onProgress: async (msg, current, total) => {
                if (current % 5 === 0 || current === total) {
                    await logInfo(domain.campaignId, `Crawling: page ${current}/${total}`, domain.id)
                }
            }
        })

        await logSuccess(domain.campaignId, `Found ${pages.length} pages`, domain.id)

        // Save pages to database
        let formsCount = 0
        let commentsCount = 0
        const savedPages = []

        for (const page of pages) {
            // Check if page already exists (no unique constraint, so manual check)
            const existingPage = await prisma.pageDiscovery.findFirst({
                where: {
                    campaignId: domain.campaignId,
                    domainId: domain.id,
                    url: page.url
                }
            })

            // Crawler returns forms/comments as arrays, need to check and serialize
            const pageData = {
                title: page.title || 'Untitled',
                hasForm: page.forms?.length > 0 || page.hasForm || false,
                hasComments: page.comments?.length > 0 || page.hasComments || false,
                formFields: page.forms?.[0] ? JSON.stringify(page.forms[0]) : null,
                commentFields: page.comments?.[0] ? JSON.stringify(page.comments[0]) : null,
            }

            let savedPage
            if (existingPage) {
                savedPage = await prisma.pageDiscovery.update({
                    where: { id: existingPage.id },
                    data: pageData
                })
            } else {
                savedPage = await prisma.pageDiscovery.create({
                    data: {
                        campaignId: domain.campaignId,
                        domainId: domain.id,
                        url: page.url,
                        ...pageData
                    }
                })
            }

            savedPages.push({ ...savedPage, originalPage: page })

            // Count forms/comments using the arrays from crawler
            if (page.forms?.length > 0 || page.hasForm) formsCount++
            if (page.comments?.length > 0 || page.hasComments) commentsCount++

            // Save contacts if extraction is enabled
            if ((page.contacts?.email || page.contacts?.phone) && config.extractEmails !== false) {
                await prisma.extractedContact.upsert({
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

        await logInfo(domain.campaignId, `Found ${formsCount} forms, ${commentsCount} comment sections`, domain.id)

        // === STEP 3: Submit Forms ===
        // targetFormsCount of 0 means "all forms", so we use formsCount as the limit
        const targetForms = (config.targetFormsCount && config.targetFormsCount > 0)
            ? config.targetFormsCount
            : formsCount

        await logInfo(domain.campaignId, `Submission config: submitForms=${domain.campaign.submitForms}, submitComments=${domain.campaign.submitComments}`, domain.id)

        // Initialize counters for status determination
        let totalFormsSubmitted = 0
        let totalFormsFailed = 0

        if (domain.campaign.submitForms && formsCount > 0) {
            await logStep(domain.campaignId, `Step 3: Submitting up to ${targetForms} forms...`, domain.id)

            for (const savedPage of savedPages) {
                // Check if this page has forms (from the originalPage data)
                const hasFormOnPage = savedPage.hasForm || savedPage.originalPage?.forms?.length > 0
                if (!hasFormOnPage || totalFormsSubmitted >= targetForms) continue

                try {
                    console.log(`    → Submitting form on ${savedPage.url}`)

                    // Get form fields from the original crawler data
                    const formData = savedPage.originalPage?.forms?.[0] || null

                    const result = await submitForm(savedPage.url, {
                        name: domain.campaign.senderName || 'Anonymous',
                        email: domain.campaign.senderEmail || 'contact@example.com',
                        message: domain.campaign.messageTemplate || 'Hello, I am interested in your services!',
                        screenshots: config.saveScreenshots !== false,
                        skipDuplicates: config.skipDuplicates !== false,
                        formFields: formData,
                    })

                    // Log submission
                    await prisma.submissionLog.create({
                        data: {
                            campaignId: domain.campaignId,
                            pageId: savedPage.id,
                            type: 'FORM',
                            status: result.success ? 'SUCCESS' : 'FAILED',
                            responseMessage: result.message,
                            screenshotUrl: result.screenshots?.after?.path || null,
                        }
                    })

                    if (result.success) {
                        totalFormsSubmitted++
                        console.log(`    ✅ Form ${totalFormsSubmitted}/${targetForms}: SUCCESS`)
                    } else {
                        totalFormsFailed++
                        console.log(`    ❌ Form ${totalFormsSubmitted + 1}/${targetForms}: FAILED (${result.message})`)
                    }
                } catch (e) {
                    totalFormsFailed++
                    console.log(`    ❌ Form failed: ${e.message}`)
                }
            }
        } else {
            if (!domain.campaign.submitForms) {
                console.log(`  ⏭️ Skipping forms: submitForms is disabled`)
            } else if (formsCount === 0) {
                console.log(`  ⏭️ Skipping forms: No forms found on any pages`)
            }
        }

        // === STEP 4: Submit Comments ===
        const targetComments = (config.targetCommentsCount && config.targetCommentsCount > 0)
            ? config.targetCommentsCount
            : commentsCount

        if (domain.campaign.submitComments && commentsCount > 0) {
            console.log(`  💬 Step 4: Submitting up to ${targetComments} comments...`)
            let submitted = 0

            for (const savedPage of savedPages) {
                // Check if this page has comments (from the originalPage data)
                const hasCommentsOnPage = savedPage.hasComments || savedPage.originalPage?.comments?.length > 0
                if (!hasCommentsOnPage || submitted >= targetComments) continue

                try {
                    console.log(`    → Submitting comment on ${savedPage.url}`)

                    // Get comment fields from crawler data
                    const commentFields = savedPage.originalPage?.comments?.[0] || null

                    // submitComment expects: (url, commentFields, submissionData)
                    const result = await submitComment(
                        savedPage.url,
                        commentFields,
                        {
                            name: domain.campaign.senderName || 'Anonymous',
                            email: domain.campaign.senderEmail || 'no-email@example.com',
                            message: domain.campaign.messageTemplate || 'Great post!',
                        }
                    )

                    // Log submission
                    await prisma.submissionLog.create({
                        data: {
                            campaignId: domain.campaignId,
                            pageId: savedPage.id,
                            type: 'COMMENT',
                            status: result.success ? 'SUCCESS' : 'FAILED',
                            responseMessage: result.message,
                        }
                    })

                    submitted++
                    console.log(`    ✅ Comment ${submitted}/${targetComments}: ${result.success ? 'SUCCESS' : 'FAILED'}`)
                } catch (e) {
                    console.log(`    ❌ Comment failed: ${e.message}`)
                }
            }
        }

        // === DOMAIN COMPLETE ===
        // Determine final status
        let finalStatus = 'COMPLETED'
        let failureReason = null

        if (domain.campaign.submitForms && formsCount > 0 && totalFormsSubmitted === 0 && totalFormsFailed > 0) {
            finalStatus = 'FAILED'
            errorMessage = 'All form submissions failed'
        }



        await prisma.domain.update({
            where: { id: domain.id },
            data: {
                status: 'COMPLETED',
                pagesDiscovered: pages.length,
            }
        })

        await logSuccess(domain.campaignId, `Domain complete: ${domain.url} (${pages.length} pages, ${formsCount} forms, ${commentsCount} comments)`, domain.id)

        // Check if campaign is complete
        const pendingDomains = await prisma.domain.count({
            where: {
                campaignId: domain.campaignId,
                status: { in: ['PENDING', 'PROCESSING'] }
            }
        })

        if (pendingDomains === 0) {
            await prisma.campaign.update({
                where: { id: domain.campaignId },
                data: { status: 'COMPLETED' }
            })
            await logSuccess(domain.campaignId, `🎉 Campaign COMPLETED!`)
        }

        return true

    } catch (error) {
        await logError(domain.campaignId, `Domain ${domain.url} failed: ${error.message}`, domain.id)

        await prisma.domain.update({
            where: { id: domain.id },
            data: {
                status: 'FAILED',
                errorMessage: error.message
            }
        })

        return true // Return true because we did process something
    }
}

/**
 * Reset stuck domains that may have been interrupted
 */
export async function resetStuckDomains() {
    try {
        const stuckDomains = await prisma.domain.updateMany({
            where: {
                status: 'PROCESSING',
                updatedAt: {
                    lt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
                }
            },
            data: {
                status: 'PENDING',
            }
        })

        if (stuckDomains.count > 0) {
            console.log(`⚠️ Reset ${stuckDomains.count} stuck domains to PENDING`)
        }
    } catch (error) {
        console.error('Failed to reset stuck domains:', error)
    }
}
