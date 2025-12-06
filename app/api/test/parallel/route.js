import { NextResponse } from 'next/server'
import { analyzeDomain } from '@/lib/crawler/domain-analyzer'
import { crawlPages } from '@/lib/crawler/page-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Process multiple domains in parallel
export async function POST(request) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const formData = await request.formData()
                const file = formData.get('file')
                const config = JSON.parse(formData.get('config'))

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

                // Read domains from file
                const content = await file.text()
                const domains = content.split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(domain => {
                        if (!domain.startsWith('http')) return `https://${domain}`
                        return domain
                    })

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
