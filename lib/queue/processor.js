import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import prisma from '../db.js'
import { analyzeDomain } from '../crawler/domain-analyzer.js'
import { crawlPages } from '../crawler/page-crawler.js'
import { detectForms, detectCommentSections } from '../crawler/detector.js'
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
            // Time limit reached to avoid blocking main thread too long
            break
        }
    }

    return {
        tasksProcessed,
        timeElapsed: Math.floor((Date.now() - startTime) / 1000),
    }
}

export async function resetStuckTasks() {
    try {
        // Find tasks that have been processing for more than 10 minutes (likely crashed)
        const stuckTasks = await prisma.processingQueue.updateMany({
            where: {
                status: 'PROCESSING',
                updatedAt: {
                    lt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
                }
            },
            data: {
                status: 'PENDING',
                errorMessage: 'Reset from stuck state (worker restart)',
                attempts: { increment: 1 } // Count as an attempt
            }
        })

        if (stuckTasks.count > 0) {
            console.log(`⚠️  Reset ${stuckTasks.count} stuck tasks to PENDING`)
        } else {
            console.log('✨ No stuck tasks found')
        }
    } catch (error) {
        console.error('Failed to reset stuck tasks:', error)
    }
}

async function getNextTask() {
    return await prisma.processingQueue.findFirst({
        where: {
            status: 'PENDING',
            scheduledFor: {
                lte: new Date(),
            },
            campaign: {
                status: 'RUNNING',
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
                result: JSON.stringify(result),
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

    // Analyze domain (sitemaps, robots.txt)
    const analysis = await analyzeDomain(domain.url)

    // === NEW: Fetch homepage for extraction ===
    let homepageEmails = []
    let homepagePhones = []
    let technology = 'Unknown'

    try {
        const homepageResponse = await fetch(domain.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(15000),
        })

        if (homepageResponse.ok) {
            const html = await homepageResponse.text()
            const headers = Object.fromEntries(homepageResponse.headers.entries())

            // Detect technology
            technology = detectTechnologyFromContent(html, analysis.robotsTxt, headers)

            // Extract emails and phones from homepage
            const { emails, phones } = extractContactsFromHtml(html)
            homepageEmails = emails
            homepagePhones = phones

            // === VITAL: Detect forms/comments & Queue Submission IMMEDIATELY ===
            // This prevents "skipping" if crawling fails later
            const forms = detectForms(html, domain.url)
            const comments = detectCommentSections(html, domain.url)

            console.log(`📧 Homepage: ${homepageEmails.length} emails, ${homepagePhones.length} phones, Tech: ${technology}, Forms: ${forms.length}, Comments: ${comments.length}`)

            if (forms.length > 0 || comments.length > 0) {
                // Check if page already exists to prevent duplicates
                const existingPage = await prisma.pageDiscovery.findFirst({
                    where: {
                        campaignId: domain.campaignId,
                        domainId: domain.id,
                        url: domain.url
                    }
                })

                let savedPage
                const pageData = {
                    title: 'Homepage',
                    hasForm: forms.length > 0,
                    hasComments: comments.length > 0,
                    formFields: forms[0] ? JSON.stringify(forms[0]) : null,
                    commentFields: comments[0] ? JSON.stringify(comments[0]) : null,
                }

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
                            url: domain.url,
                            ...pageData
                        },
                    })
                }

                // Queue submission tasks (High Priority)
                if (forms.length > 0 && domain.campaign.submitForms) {
                    await prisma.processingQueue.create({
                        data: {
                            campaignId: domain.campaignId,
                            domainId: domain.id, // Ensure domainId is set for tracking
                            pageId: savedPage.id,
                            taskType: 'SUBMIT_FORM',
                            priority: 8, // Higher priority than deep pages
                        },
                    })
                }

                if (comments.length > 0 && domain.campaign.submitComments) {
                    await prisma.processingQueue.create({
                        data: {
                            campaignId: domain.campaignId,
                            domainId: domain.id,
                            pageId: savedPage.id,
                            taskType: 'SUBMIT_COMMENT',
                            priority: 8,
                        },
                    })
                }
            }
        }
    } catch (e) {
        console.log(`Failed to fetch homepage for extraction: ${e.message}`)
    }

    // Save results including technology and homepage contacts
    await prisma.domain.update({
        where: { id: domain.id },
        data: {
            hasRobotsTxt: !!analysis.robotsTxt,
            robotsTxtContent: analysis.robotsTxt,
            sitemapsFound: analysis.sitemaps.length,
            technology: technology,
        },
    })

    // Save homepage contacts
    if (homepageEmails.length > 0 || homepagePhones.length > 0) {
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
                email: homepageEmails.join(', '),
                phone: homepagePhones.join(', '),
                extractedFrom: domain.url,
            },
            update: {
                email: homepageEmails.join(', '),
                phone: homepagePhones.join(', '),
                extractedFrom: domain.url,
            },
        })
    }

    // Queue crawl task
    await prisma.processingQueue.create({
        data: {
            campaignId: domain.campaignId,
            domainId: domain.id,
            taskType: 'CRAWL_PAGES',
            priority: 5,
            payload: JSON.stringify({
                urls: analysis.urls,
                robots: analysis.robotsTxt,
            }),
        },
    })

    return {
        urlsFound: analysis.urls.length,
        technology,
        emailsFound: homepageEmails.length,
        phonesFound: homepagePhones.length,
    }
}

async function processCrawlPages(task) {
    const domain = await prisma.domain.findUnique({
        where: { id: task.domainId },
        include: { campaign: true },
    })

    if (!domain) throw new Error('Domain not found')

    let payload = {}
    try {
        payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {})
    } catch (e) {
        console.error('Failed to parse task payload:', e)
    }
    const { urls = [], robots = null } = payload

    // Parse campaign config for advanced options
    let campaignConfig = {}
    try {
        if (domain.campaign.config) {
            campaignConfig = JSON.parse(domain.campaign.config)
        }
    } catch (e) {
        console.error('Failed to parse campaign config:', e)
    }

    // Initialize robots parser if content exists
    let robotsParser = null
    if (robots) {
        const robotsParserLib = require('robots-parser')
        robotsParser = robotsParserLib(domain.url + '/robots.txt', robots)
    }

    // Crawl pages
    const pages = await crawlPages(domain.url, {
        maxPages: domain.campaign.maxPagesPerDomain,
        robots: robotsParser,
        initialUrls: urls,
        // Advanced options from config
        skipEmails: campaignConfig.skipEmails,
        skipPhones: campaignConfig.skipPhones,
        priorityPages: campaignConfig.priorityPages,
        stopOnTarget: campaignConfig.stopOnTarget,
        targetFormsCount: campaignConfig.targetFormsCount,
        targetCommentsCount: campaignConfig.targetCommentsCount,
        rateLimit: campaignConfig.rateLimit,
    })

    // Track submissions per domain for target limits
    let formsQueued = 0
    let commentsQueued = 0
    const targetForms = campaignConfig.targetFormsCount || 999
    const targetComments = campaignConfig.targetCommentsCount || 999

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
                    formFields: page.forms[0] ? JSON.stringify(page.forms[0]) : null,
                    commentFields: page.comments[0] ? JSON.stringify(page.comments[0]) : null,
                },
            })

            // Queue submission tasks (respecting target limits)
            if (page.hasForm && domain.campaign.submitForms && formsQueued < targetForms) {
                await prisma.processingQueue.create({
                    data: {
                        campaignId: domain.campaignId,
                        pageId: savedPage.id,
                        taskType: 'SUBMIT_FORM',
                        priority: 3,
                    },
                })
                formsQueued++
            }

            if (page.hasComments && domain.campaign.submitComments && commentsQueued < targetComments) {
                await prisma.processingQueue.create({
                    data: {
                        campaignId: domain.campaignId,
                        pageId: savedPage.id,
                        taskType: 'SUBMIT_COMMENT',
                        priority: 3,
                    },
                })
                commentsQueued++
            }

            // Stop early if we've hit all targets
            if (campaignConfig.stopOnTarget && formsQueued >= targetForms && commentsQueued >= targetComments) {
                console.log(`  🎯 Target reached for ${domain.url}: ${formsQueued} forms, ${commentsQueued} comments`)
                break
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

    // Parse config
    let config = {}
    try {
        if (page.campaign.config) {
            config = JSON.parse(page.campaign.config)
        }
    } catch (e) { }

    const result = await submitForm(page.url, page.formFields, submissionData, {
        allowResubmit: true // Always allow resubmit for background tests based on user feedback 
        // OR: allowResubmit: config.allowResubmit === true
    })

    // Log submission
    await prisma.submissionLog.create({
        data: {
            campaignId: page.campaignId,
            pageId: page.id,
            type: 'FORM',
            status: result.status,
            submittedData: JSON.stringify(submissionData),
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

    // Parse config
    let config = {}
    try {
        if (page.campaign.config) {
            config = JSON.parse(page.campaign.config)
        }
    } catch (e) { }

    const result = await submitComment(page.url, page.commentFields, submissionData, {
        allowResubmit: true // Always allow resubmit for background tests based on user feedback
    })

    // Log submission
    await prisma.submissionLog.create({
        data: {
            campaignId: page.campaignId,
            pageId: page.id,
            type: 'COMMENT',
            status: result.status,
            submittedData: JSON.stringify(submissionData),
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

// === HELPER FUNCTIONS FOR EXTRACTION ===

function detectTechnologyFromContent(html, robotsTxt, headers) {
    const content = (html + ' ' + (robotsTxt || '')).toLowerCase()
    const xPoweredBy = headers['x-powered-by'] || ''
    const xGenerator = headers['x-generator'] || ''

    // WordPress
    if (content.includes('wp-content') || content.includes('wordpress') || xPoweredBy.includes('WordPress')) {
        return 'WordPress'
    }

    // Shopify
    if (content.includes('cdn.shopify.com') || content.includes('shopify') || headers['x-shopid']) {
        return 'Shopify'
    }

    // Wix
    if (content.includes('wix.com') || content.includes('_wix') || headers['x-wix-request-id']) {
        return 'Wix'
    }

    // Squarespace
    if (content.includes('squarespace') || content.includes('static.squarespace')) {
        return 'Squarespace'
    }

    // Joomla
    if (content.includes('/media/jui/') || content.includes('joomla') || xGenerator.includes('Joomla')) {
        return 'Joomla'
    }

    // Drupal
    if (content.includes('/sites/default/files') || content.includes('drupal') || xGenerator.includes('Drupal')) {
        return 'Drupal'
    }

    // Laravel
    if (content.includes('laravel') || xPoweredBy.toLowerCase().includes('laravel')) {
        return 'Laravel'
    }

    // Next.js
    if (content.includes('_next/static') || xPoweredBy.includes('Next.js')) {
        return 'Next.js'
    }

    // React
    if (content.includes('react') || content.includes('__react')) {
        return 'React'
    }

    // Generic PHP
    if (xPoweredBy.toLowerCase().includes('php')) {
        return 'PHP'
    }

    return xPoweredBy || 'Unknown'
}

function extractContactsFromHtml(html) {
    const emails = []
    const phones = []

    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const emailMatches = html.match(emailRegex) || []

    emailMatches.forEach(email => {
        const lowerEmail = email.toLowerCase()
        // Filter out common junk emails
        if (!lowerEmail.includes('example.com') &&
            !lowerEmail.includes('test@') &&
            !lowerEmail.includes('noreply') &&
            !lowerEmail.includes('no-reply') &&
            !lowerEmail.includes('wixpress') &&
            !emails.includes(email)) {
            emails.push(email)
        }
    })

    // Extract from mailto: links
    const mailtoRegex = /href=["']mailto:([^"'?]+)/g
    let mailtoMatch
    while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
        const email = mailtoMatch[1]
        if (!emails.includes(email)) {
            emails.push(email)
        }
    }

    // Extract phones
    const phoneRegexes = [
        /\+?[\d\s\-().]{10,20}/g,  // General phone pattern
        /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,  // (123) 456-7890
        /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,  // 123-456-7890
    ]

    phoneRegexes.forEach(regex => {
        const matches = html.match(regex) || []
        matches.forEach(phone => {
            const cleaned = phone.replace(/[\s\-().]/g, '')
            // Must have at least 10 digits
            if (cleaned.length >= 10 && cleaned.length <= 15 && !phones.includes(phone.trim())) {
                phones.push(phone.trim())
            }
        })
    })

    // Extract from tel: links
    const telRegex = /href=["']tel:([^"']+)/g
    let telMatch
    while ((telMatch = telRegex.exec(html)) !== null) {
        const phone = telMatch[1]
        if (!phones.includes(phone)) {
            phones.push(phone)
        }
    }

    return {
        emails: [...new Set(emails)].slice(0, 10),  // Max 10 unique emails
        phones: [...new Set(phones)].slice(0, 5)    // Max 5 unique phones
    }
}

