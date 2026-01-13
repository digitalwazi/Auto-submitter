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

/**
 * Process the next available domain completely (sequential steps)
 * Returns true if a domain was processed, false if no domains available
 */
export async function processNextDomain() {
    // Get next pending domain from a running campaign
    const domain = await prisma.domain.findFirst({
        where: {
            status: 'PENDING',
            campaign: {
                status: 'RUNNING'
            }
        },
        include: {
            campaign: true
        },
        orderBy: {
            createdAt: 'asc'
        }
    })

    if (!domain) {
        return false // No domains to process
    }

    console.log(`\n🌐 Processing domain: ${domain.url}`)

    // Mark as processing to prevent other workers from picking it up
    await prisma.domain.update({
        where: { id: domain.id },
        data: { status: 'PROCESSING' }
    })

    try {
        // Parse campaign config
        let config = {}
        try {
            if (domain.campaign.config) {
                config = JSON.parse(domain.campaign.config)
            }
        } catch (e) { }

        // === STEP 1: Analyze Domain ===
        console.log(`  📊 Step 1: Analyzing domain...`)
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
        console.log(`  🕷️ Step 2: Crawling pages (max ${config.maxPages || 20})...`)
        const pages = await crawlPages(domain.url, {
            maxPages: config.maxPages || 20,
            sitemaps: analysis.sitemaps,
            extractEmails: config.extractEmails !== false,
            extractPhones: config.extractPhones !== false,
            extractForms: config.extractForms !== false,
            extractComments: config.extractComments !== false,
            priorityPages: config.priorityPages !== false,
        })

        console.log(`  📄 Found ${pages.length} pages`)

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

            const pageData = {
                title: page.title || 'Untitled',
                hasForm: page.hasForm || false,
                hasComments: page.hasComments || false,
                formFields: page.formFields ? JSON.stringify(page.formFields) : null,
                commentFields: page.commentFields ? JSON.stringify(page.commentFields) : null,
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

            if (page.hasForm) formsCount++
            if (page.hasComments) commentsCount++

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

        console.log(`  📋 Found ${formsCount} forms, ${commentsCount} comment sections`)

        // === STEP 3: Submit Forms ===
        if (domain.campaign.submitForms && formsCount > 0) {
            console.log(`  📝 Step 3: Submitting forms...`)
            const targetForms = config.targetFormsCount || formsCount
            let submitted = 0

            for (const savedPage of savedPages) {
                if (!savedPage.hasForm || submitted >= targetForms) continue

                try {
                    console.log(`    → Submitting form on ${savedPage.url}`)
                    const result = await submitForm(savedPage.url, {
                        name: domain.campaign.senderName,
                        email: domain.campaign.senderEmail,
                        message: domain.campaign.messageTemplate,
                        screenshots: config.saveScreenshots !== false,
                        skipDuplicates: config.skipDuplicates !== false,
                        formFields: savedPage.originalPage?.formFields,
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

                    submitted++
                    console.log(`    ✅ Form ${submitted}/${targetForms}: ${result.status}`)
                } catch (e) {
                    console.log(`    ❌ Form failed: ${e.message}`)
                }
            }
        }

        // === STEP 4: Submit Comments ===
        if (domain.campaign.submitComments && commentsCount > 0) {
            console.log(`  💬 Step 4: Submitting comments...`)
            const targetComments = config.targetCommentsCount || commentsCount
            let submitted = 0

            for (const savedPage of savedPages) {
                if (!savedPage.hasComments || submitted >= targetComments) continue

                try {
                    console.log(`    → Submitting comment on ${savedPage.url}`)
                    const result = await submitComment(savedPage.url, {
                        name: domain.campaign.senderName,
                        email: domain.campaign.senderEmail,
                        message: domain.campaign.messageTemplate,
                    })

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
                    console.log(`    ✅ Comment ${submitted}/${targetComments}: ${result.status}`)
                } catch (e) {
                    console.log(`    ❌ Comment failed: ${e.message}`)
                }
            }
        }

        // === DOMAIN COMPLETE ===
        await prisma.domain.update({
            where: { id: domain.id },
            data: {
                status: 'COMPLETED',
                pagesDiscovered: pages.length,
            }
        })

        console.log(`✅ Domain complete: ${domain.url} (${pages.length} pages, ${formsCount} forms, ${commentsCount} comments)`)

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
            console.log(`🎉 Campaign ${domain.campaignId} COMPLETED!`)
        }

        return true

    } catch (error) {
        console.error(`❌ Domain ${domain.url} failed: ${error.message}`)

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
