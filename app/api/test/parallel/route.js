import { NextResponse } from 'next/server'
import { analyzeDomain } from '@/lib/crawler/domain-analyzer'
import { crawlPages } from '@/lib/crawler/page-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Process multiple domains in parallel
export async function POST(request) {
    const encoder = new TextEncoder()

    // Check if it's a background run request
    // We need to clone the request because we might need to read the body twice 
    // (though here we just read form data once)
    const formData = await request.formData()
    const file = formData.get('file')
    const configStr = formData.get('config')
    const config = JSON.parse(configStr)

    // Read domains from file
    const content = await file.text()
    const domains = content.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(domain => {
            if (!domain.startsWith('http')) return `https://${domain}`
            return domain
        })

    // === BACKGROUND MODE ===
    if (config.runInBackground) {
        try {
            // Import prisma dynamically to avoid issues if not used
            const { default: prisma } = await import('@/lib/db')

            // 1. Create Campaign
            const campaign = await prisma.campaign.create({
                data: {
                    name: config.campaignName?.trim() || `Campaign ${new Date().toLocaleString()}`,
                    status: 'RUNNING',
                    processingMode: 'BACKGROUND',
                    maxPagesPerDomain: config.maxPages || 20,
                    submitForms: config.submitForms || false,
                    submitComments: config.submitComments || false,
                    messageTemplate: config.message || config.messageTemplate || '',
                    senderName: config.senderName || '',
                    senderEmail: config.senderEmail || '',
                    config: JSON.stringify(config),
                    totalDomains: domains.length,
                }
            })

            // 2. Calculate Estimated Time (Moved up for immediate response)
            // Average time per domain: ~1-2 minutes (analysis + crawl + optional submission)
            // With BATCH_SIZE=5 parallel processing
            const parallelWorkers = 5
            const avgMinutesPerDomain = 1.5
            const totalMinutes = Math.ceil((domains.length / parallelWorkers) * avgMinutesPerDomain)
            const hours = Math.floor(totalMinutes / 60)
            const minutes = totalMinutes % 60

            let estimatedTime = ''
            if (hours > 24) {
                const days = Math.floor(hours / 24)
                const remainingHours = hours % 24
                estimatedTime = `~${days} days ${remainingHours} hours`
            } else if (hours > 0) {
                estimatedTime = `~${hours} hours ${minutes} minutes`
            } else {
                estimatedTime = `~${minutes} minutes`
            }

            // 3. Create Domains in Batches (FIRE AND FORGET)
            // We run this asynchronously so the UI gets a response immediately
            // This prevents timezone/server timeouts on large files (10k+ domains)
            (async () => {
                try {
                    // BATCH SIZE NOTE: SQLite has a variable limit. 500 * 3 fields = 1500 vars.
                    // Safe limit is usually around 999 for older SQLite, but we'll stick to 200 to be ultra-safe.
                    const batchSize = 200 // Reduced from 500 to 200 to avoid SQLite parameter limits
                    let processed = 0

                    console.log(`🚀 Starting background insertion of ${domains.length} domains for campaign ${campaign.id}`)

                    for (let i = 0; i < domains.length; i += batchSize) {
                        const batch = domains.slice(i, i + batchSize)

                        // Use createMany for bulk insert performance
                        await prisma.domain.createMany({
                            data: batch.map(url => ({
                                campaignId: campaign.id,
                                url: url,
                                status: 'PENDING',
                            })),
                            // Note: skipDuplicates not supported in SQLite
                        })

                        processed += batch.length

                        // Yield DB lock to let workers process concurrently
                        await new Promise(resolve => setTimeout(resolve, 100))

                        // Log progress for very large uploads
                        if (domains.length > 1000 && processed % 5000 === 0) {
                            console.log(`📦 Created ${processed}/${domains.length} domains...`)
                        }
                    }
                    console.log(`✅ Finished inserting ${processed} domains for campaign ${campaign.id}`)
                } catch (err) {
                    console.error('❌ Background Domain Insertion Failed:', err)
                }
            })()

            // Return success immediately
            return NextResponse.json({
                success: true,
                message: `Started background processing for ${domains.length} domains.`,
                campaignId: campaign.id,
                estimatedTime: estimatedTime
            })



        } catch (error) {
            console.error('Background Enqueue Error:', error)
            return NextResponse.json(
                { success: false, error: `Server Error: ${error.message}` },
                { status: 500 }
            )
        }
    }

    // === FOREGROUND STREAMING MODE (Existing Logic) ===
    const stream = new ReadableStream({
        async start(controller) {
            try {
                const sendLog = (message, type = 'info') => {
                    const data = JSON.stringify({ log: { message, type } })
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }

                const sendProgress = (current, total) => {
                    const data = JSON.stringify({ progress: { current, total } })
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }

                const sendResult = (result) => {
                    const data = JSON.stringify({ result })
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }

                sendLog(`📁 Loaded ${domains.length} domains from file`)
                sendProgress(0, domains.length)

                const parallelism = config.parallelDomains || 3
                sendLog(`🚀 Processing ${parallelism} domains in parallel...`)

                // Process domains in batches
                for (let i = 0; i < domains.length; i += parallelism) {
                    const batch = domains.slice(i, Math.min(i + parallelism, domains.length))

                    // Process batch in parallel
                    const batchPromises = batch.map(async (domainUrl, batchIndex) => {
                        const globalIndex = i + batchIndex
                        const domainLabel = `[${globalIndex + 1}/${domains.length}]`

                        sendLog(`\n${domainLabel} 🔍 Processing: ${domainUrl}`)

                        const result = {
                            domain: domainUrl,
                            status: 'pending',
                            technology: null,
                            formPages: [],
                            commentPages: [],
                            emails: [],
                            phones: [],
                            totalPages: 0,
                        }

                        try {
                            // Step 1: Analyze domain
                            sendLog(`${domainLabel} ↳ Analyzing...`)
                            const analysis = await analyzeDomain(domainUrl)

                            // Step 1.5: Extract from HOMEPAGE FIRST
                            sendLog(`${domainLabel} ↳ Extracting from homepage...`)
                            try {
                                const homepageResponse = await fetch(domainUrl, {
                                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                                    signal: AbortSignal.timeout(15000),
                                })
                                if (homepageResponse.ok) {
                                    const html = await homepageResponse.text()

                                    // Extract emails from homepage
                                    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
                                    const emailMatches = html.match(emailRegex) || []
                                    emailMatches.forEach(email => {
                                        const lower = email.toLowerCase()
                                        if (!lower.includes('example.com') && !lower.includes('test@') &&
                                            !lower.includes('noreply') && !result.emails.includes(email)) {
                                            result.emails.push(email)
                                        }
                                    })

                                    // Extract from mailto: links
                                    const mailtoRegex = /href=["']mailto:([^"'?]+)/g
                                    let match
                                    while ((match = mailtoRegex.exec(html)) !== null) {
                                        if (!result.emails.includes(match[1])) result.emails.push(match[1])
                                    }

                                    // Extract phones from homepage
                                    const phoneRegex = /\+?[\d\s\-().]{10,20}/g
                                    const phoneMatches = html.match(phoneRegex) || []
                                    phoneMatches.forEach(phone => {
                                        const cleaned = phone.replace(/[\s\-().]/g, '')
                                        if (cleaned.length >= 10 && cleaned.length <= 15 && !result.phones.includes(phone.trim())) {
                                            result.phones.push(phone.trim())
                                        }
                                    })

                                    // Extract from tel: links
                                    const telRegex = /href=["']tel:([^"']+)/g
                                    while ((match = telRegex.exec(html)) !== null) {
                                        if (!result.phones.includes(match[1])) result.phones.push(match[1])
                                    }

                                    if (result.emails.length > 0 || result.phones.length > 0) {
                                        sendLog(`${domainLabel} ✓ Homepage: ${result.emails.length} emails, ${result.phones.length} phones`)
                                    }
                                }
                            } catch (e) {
                                sendLog(`${domainLabel} ⚠ Homepage extraction failed: ${e.message}`)
                            }

                            // Step 2: Detect technology
                            if (config.detectTechnology) {
                                result.technology = detectTechnology(analysis)
                                sendLog(`${domainLabel} ✓ Tech: ${result.technology}`)
                            }

                            // Step 3: Crawl pages
                            sendLog(`${domainLabel} ↳ Crawling (max ${config.maxPages})...`)
                            const pages = await crawlPages(domainUrl, {
                                maxPages: config.maxPages,
                                robots: analysis.robots,
                                initialUrls: analysis.urls.slice(0, 20),
                                skipEmails: config.skipEmails,
                                skipPhones: config.skipPhones,
                                priorityPages: config.priorityPages,
                                stopOnTarget: config.stopOnTarget,
                                targetFormsCount: config.targetFormsCount,
                                targetCommentsCount: config.targetCommentsCount,
                                rateLimit: config.rateLimit,
                            })

                            result.totalPages = pages.length

                            // Step 4: Extract data
                            for (const page of pages) {
                                if (config.extractForms && page.hasForm) {
                                    result.formPages.push(page.url)
                                }

                                if (config.extractComments && page.hasComments) {
                                    result.commentPages.push(page.url)
                                }

                                if (config.extractEmails && page.contacts?.email) {
                                    if (!result.emails.includes(page.contacts.email)) {
                                        result.emails.push(page.contacts.email)
                                    }
                                }

                                if (config.extractPhones && page.contacts?.phone) {
                                    if (!result.phones.includes(page.contacts.phone)) {
                                        result.phones.push(page.contacts.phone)
                                    }
                                }
                            }

                            result.status = 'success'
                            sendLog(`${domainLabel} ✅ Found: ${result.formPages.length} forms, ${result.commentPages.length} comments`, 'success')

                            // Step 5: Submit if mode is 'submit'
                            if (config.mode === 'submit') {
                                // Submit to forms
                                if (config.submitForms && result.formPages.length > 0) {
                                    sendLog(`${domainLabel} ↳ Submitting ${result.formPages.length} forms...`)

                                    for (const formPageUrl of result.formPages) {
                                        try {
                                            const { submitForm } = await import('@/lib/automation/form-submitter')
                                            const formPage = pages.find(p => p.url === formPageUrl)

                                            if (formPage?.forms?.[0]) {
                                                const submitResult = await submitForm(formPageUrl, formPage.forms[0], {
                                                    name: config.senderName,
                                                    email: config.senderEmail,
                                                    message: config.message,
                                                })

                                                if (submitResult.success) {
                                                    sendLog(`${domainLabel}   ✓ Form submitted`, 'success')
                                                }
                                            }
                                        } catch (error) {
                                            sendLog(`${domainLabel}   ✗ Form error: ${error.message}`, 'warning')
                                        }
                                    }
                                }

                                // Submit to comments
                                if (config.submitComments && result.commentPages.length > 0) {
                                    sendLog(`${domainLabel} ↳ Submitting ${result.commentPages.length} comments...`)

                                    for (const commentPageUrl of result.commentPages) {
                                        try {
                                            const { submitComment } = await import('@/lib/automation/comment-submitter')
                                            const commentPage = pages.find(p => p.url === commentPageUrl)

                                            if (commentPage?.comments?.[0]) {
                                                const submitResult = await submitComment(commentPageUrl, commentPage.comments[0], {
                                                    name: config.senderName,
                                                    email: config.senderEmail,
                                                    message: config.message,
                                                })

                                                if (submitResult.success) {
                                                    sendLog(`${domainLabel}   ✓ Comment submitted`, 'success')
                                                }
                                            }
                                        } catch (error) {
                                            sendLog(`${domainLabel}   ✗ Comment error: ${error.message}`, 'warning')
                                        }
                                    }
                                }
                            }

                        } catch (error) {
                            result.status = 'failed'
                            sendLog(`${domainLabel} ❌ Error: ${error.message}`, 'error')
                        }

                        return { result, index: globalIndex }
                    })

                    // Wait for batch to complete
                    const batchResults = await Promise.all(batchPromises)

                    // Send results in order
                    batchResults
                        .sort((a, b) => a.index - b.index)
                        .forEach(({ result, index }) => {
                            sendResult(result)
                            sendProgress(index + 1, domains.length)
                        })
                }

                sendLog(`\n✅ All ${domains.length} domains processed!`, 'success')
                controller.close()

            } catch (error) {
                const data = JSON.stringify({ log: { message: `Fatal error: ${error.message}`, type: 'error' } })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                controller.close()
            }
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}

function detectTechnology(analysis) {
    const content = (analysis.robotsTxt || '').toLowerCase()
    const headers = analysis.headers || {}

    if (content.includes('wp-') || content.includes('wordpress') ||
        headers['x-powered-by']?.includes('WordPress')) {
        return 'WordPress'
    }

    if (content.includes('joomla') || headers['x-content-encoded-by']?.includes('Joomla')) {
        return 'Joomla'
    }

    if (content.includes('drupal') || headers['x-generator']?.includes('Drupal')) {
        return 'Drupal'
    }

    if (content.includes('shopify') || headers['x-shopid']) {
        return 'Shopify'
    }

    if (content.includes('wix.com') || headers['x-wix-request-id']) {
        return 'Wix'
    }

    if (headers['x-powered-by']?.includes('Next.js')) {
        return 'Next.js'
    }

    if (content.includes('react') || headers['x-react']) {
        return 'React'
    }

    return headers['x-powered-by'] || 'Unknown'
}
