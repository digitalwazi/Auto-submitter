import prisma from '../db.js'
import { analyzeDomain } from '../crawler/domain-analyzer.js'
import { crawlPages } from '../crawler/page-crawler.js'
import { submitForm } from '../automation/form-submitter.js'
import { submitComment } from '../automation/comment-submitter.js'

export async function processQueue(maxTasks = 10, maxTimeSeconds = 240) {
    const startTime = Date.now()
    const endTime = startTime + (maxTimeSeconds * 1000)

    let tasksProcessed = 0

    while (tasksProcessed < maxTasks && Date.now() < endTime) {
        // Get next task
        const task = await getNextTask()

        if (!task) {
            console.log('No more tasks in queue')
            break
        }

        console.log(`Processing task: ${task.taskType} (${task.id})`)

        try {
            await processTask(task)
            tasksProcessed++
        } catch (error) {
            console.error(`Task ${task.id} failed:`, error.message)
        }

        // Check time limit
        if (Date.now() >= endTime) {
            console.log('Time limit reached')
            break
        }
    }

    return {
        tasksProcessed,
        timeElapsed: Math.floor((Date.now() - startTime) / 1000),
    }
}

async function getNextTask() {
    return await prisma.processingQueue.findFirst({
        where: {
            status: 'PENDING',
            attempts: {
                lt: prisma.raw('max_attempts'),
            },
            scheduledFor: {
                lte: new Date(),
            },
        },
        orderBy: [
            { priority: 'desc' },
            { scheduledFor: 'asc' },
        ],
    })
}

async function processTask(task) {
    // Mark as processing
    await prisma.processingQueue.update({
        where: { id: task.id },
        data: {
            status: 'PROCESSING',
            startedAt: new Date(),
            attempts: { increment: 1 },
        },
    })

    try {
        let result = null

        switch (task.taskType) {
            case 'ANALYZE_DOMAIN':
                result = await processDomainAnalysis(task)
                break
            case 'CRAWL_PAGES':
                result = await processCrawlPages(task)
                break
            case 'SUBMIT_FORM':
                result = await processFormSubmission(task)
                break
            case 'SUBMIT_COMMENT':
                result = await processCommentSubmission(task)
                break
            case 'EXTRACT_CONTACTS':
                result = await processContactExtraction(task)
                break
            default:
                throw new Error(`Unknown task type: ${task.taskType}`)
        }

        // Mark as completed
        await prisma.processingQueue.update({
            where: { id: task.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                result,
            },
        })

    } catch (error) {
        // Check if should retry
        const shouldRetry = task.attempts < task.maxAttempts - 1

        await prisma.processingQueue.update({
            where: { id: task.id },
            data: {
                status: shouldRetry ? 'PENDING' : 'FAILED',
                errorMessage: error.message,
                completedAt: shouldRetry ? null : new Date(),
                scheduledFor: shouldRetry ? new Date(Date.now() + 60000) : undefined, // Retry in 1 min
            },
        })

        throw error
    }
}

async function processDomainAnalysis(task) {
    const domain = await prisma.domain.findUnique({
        where: { id: task.domainId },
        include: { campaign: true },
    })

    if (!domain) throw new Error('Domain not found')

    // Update domain status
    await prisma.domain.update({
        where: { id: domain.id },
        data: { status: 'PROCESSING' },
    })

    // Analyze domain
    const analysis = await analyzeDomain(domain.url)

    // Save results
    await prisma.domain.update({
        where: { id: domain.id },
        data: {
            hasRobotsTxt: !!analysis.robotsTxt,
            robotsTxtContent: analysis.robotsTxt,
            sitemapsFound: analysis.sitemaps.length,
        },
    })

    // Queue crawl task
    await prisma.processingQueue.create({
        data: {
            campaignId: domain.campaignId,
            domainId: domain.id,
            taskType: 'CRAWL_PAGES',
            priority: 5,
            payload: {
                urls: analysis.urls,
                robots: analysis.robotsTxt,
            },
        },
    })

    return { urlsFound: analysis.urls.length }
}

async function processCrawlPages(task) {
    const domain = await prisma.domain.findUnique({
        where: { id: task.domainId },
        include: { campaign: true },
    })

    if (!domain) throw new Error('Domain not found')

    const { urls = [], robots = null } = task.payload || {}

    // Crawl pages
    const pages = await crawlPages(domain.url, {
        maxPages: domain.campaign.maxPagesPerDomain,
        robots,
        initialUrls: urls,
    })

    // Save discovered pages
    for (const page of pages) {
        if (page.hasForm || page.hasComments) {
            const savedPage = await prisma.pageDiscovery.create({
                data: {
                    campaignId: domain.campaignId,
                    domainId: domain.id,
                    url: page.url,
                    title: page.title,
                    hasForm: page.hasForm,
                    hasComments: page.hasComments,
                    formFields: page.forms[0] || null,
                    commentFields: page.comments[0] || null,
                },
            })

            // Queue submission tasks
            if (page.hasForm && domain.campaign.submitForms) {
                await prisma.processingQueue.create({
                    data: {
                        campaignId: domain.campaignId,
                        pageId: savedPage.id,
                        taskType: 'SUBMIT_FORM',
                        priority: 3,
                    },
                })
            }

            if (page.hasComments && domain.campaign.submitComments) {
                await prisma.processingQueue.create({
                    data: {
                        campaignId: domain.campaignId,
                        pageId: savedPage.id,
                        taskType: 'SUBMIT_COMMENT',
                        priority: 3,
                    },
                })
            }
        }

        // Save contacts if found
        if (page.contacts.email || page.contacts.phone) {
            await prisma.extractedContact.upsert({
                where: {
                    campaignId_domainId: {
                        campaignId: domain.campaignId,
                        domainId: domain.id,
                    },
                },
                create: {
                    campaignId: domain.campaignId,
                    domainId: domain.id,
                    email: page.contacts.email,
                    phone: page.contacts.phone,
                    extractedFrom: page.url,
                },
                update: {
                    email: page.contacts.email,
                    phone: page.contacts.phone,
                    extractedFrom: page.url,
                },
            })
        }
    }

    // Update domain
    await prisma.domain.update({
        where: { id: domain.id },
        data: {
            status: 'COMPLETED',
            pagesDiscovered: pages.length,
            processedAt: new Date(),
        },
    })

    // Update campaign stats
    await updateCampaignStats(domain.campaignId)

    return { pagesDiscovered: pages.length }
}

async function processFormSubmission(task) {
    const page = await prisma.pageDiscovery.findUnique({
        where: { id: task.pageId },
        include: { campaign: true },
    })

    if (!page) throw new Error('Page not found')

    const submissionData = {
        name: page.campaign.senderName,
        email: page.campaign.senderEmail,
        message: page.campaign.messageTemplate,
        subject: 'Contact Inquiry',
    }

    const result = await submitForm(page.url, page.formFields, submissionData)

    // Log submission
    await prisma.submissionLog.create({
        data: {
            campaignId: page.campaignId,
            pageId: page.id,
            type: 'FORM',
            status: result.status,
            submittedData: submissionData,
            responseMessage: result.message,
            screenshotUrl: result.screenshot,
            errorMessage: result.success ? null : result.message,
        },
    })

    // Update campaign stats
    if (result.success) {
        await prisma.campaign.update({
            where: { id: page.campaignId },
            data: { formsSubmitted: { increment: 1 } },
        })
    }

    return result
}

async function processCommentSubmission(task) {
    const page = await prisma.pageDiscovery.findUnique({
        where: { id: task.pageId },
        include: { campaign: true },
    })

    if (!page) throw new Error('Page not found')

    const submissionData = {
        name: page.campaign.senderName,
        email: page.campaign.senderEmail,
        message: page.campaign.messageTemplate,
    }

    const result = await submitComment(page.url, page.commentFields, submissionData)

    // Log submission
    await prisma.submissionLog.create({
        data: {
            campaignId: page.campaignId,
            pageId: page.id,
            type: 'COMMENT',
            status: result.status,
            submittedData: submissionData,
            responseMessage: result.message,
            screenshotUrl: result.screenshot,
            errorMessage: result.success ? null : result.message,
        },
    })

    // Update campaign stats
    if (result.success) {
        await prisma.campaign.update({
            where: { id: page.campaignId },
            data: { commentsSubmitted: { increment: 1 } },
        })
    }

    return result
}

async function processContactExtraction(task) {
    // Already handled in crawl pages
    return { success: true }
}

async function updateCampaignStats(campaignId) {
    const stats = await prisma.domain.aggregate({
        where: { campaignId },
        _count: { id: true },
        _sum: { pagesDiscovered: true },
    })

    const processedCount = await prisma.domain.count({
        where: {
            campaignId,
            status: 'COMPLETED',
        },
    })

    await prisma.campaign.update({
        where: { id: campaignId },
        data: {
            totalDomains: stats._count.id,
            processedDomains: processedCount,
            totalPages: stats._sum.pagesDiscovered || 0,
        },
    })
}
