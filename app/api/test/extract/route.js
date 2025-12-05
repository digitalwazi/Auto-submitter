import { NextResponse } from 'next/server'
import { analyzeDomain } from '@/lib/crawler/domain-analyzer'
import { crawlPages } from '@/lib/crawler/page-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

                // Process each domain
                for (let i = 0; i < domains.length; i++) {
                    const domainUrl = domains[i]
                    sendLog(`\n🔍 [${i + 1}/${domains.length}] Processing: ${domainUrl}`, 'info')

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
                        sendLog(`  ↳ Analyzing domain...`)
                        const analysis = await analyzeDomain(domainUrl)

                        // Step 2: Detect technology
                        if (config.detectTechnology) {
                            result.technology = detectTechnology(analysis)
                            sendLog(`  ✓ Technology: ${result.technology}`)
                        }

                        // Step 3: Crawl pages
                        sendLog(`  ↳ Crawling pages (max ${config.maxPages})...`)
                        const pages = await crawlPages(domainUrl, {
                            maxPages: config.maxPages,
                            robots: analysis.robots,
                            initialUrls: analysis.urls.slice(0, 20),
                        })

                        result.totalPages = pages.length

                        // Step 4: Extract data
                        for (const page of pages) {
                            // Extract form pages
                            if (config.extractForms && page.hasForm) {
                                result.formPages.push(page.url)
                            }

                            // Extract comment pages
                            if (config.extractComments && page.hasComments) {
                                result.commentPages.push(page.url)
                            }

                            // Extract contacts
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
                        sendLog(`  ✅ Found: ${result.formPages.length} forms, ${result.commentPages.length} comments, ${result.emails.length} emails, ${result.phones.length} phones`, 'success')

                    } catch (error) {
                        result.status = 'failed'
                        sendLog(`  ❌ Error: ${error.message}`, 'error')
                    }

                    sendResult(result)
                    sendProgress(i + 1, domains.length)
                }

                sendLog(`\n✅ Processing completed! Processed ${domains.length} domains.`, 'success')
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

    // WordPress
    if (content.includes('wp-') || content.includes('wordpress') ||
        headers['x-powered-by']?.includes('WordPress')) {
        return 'WordPress'
    }

    // Joomla
    if (content.includes('joomla') || headers['x-content-encoded-by']?.includes('Joomla')) {
        return 'Joomla'
    }

    // Drupal
    if (content.includes('drupal') || headers['x-generator']?.includes('Drupal')) {
        return 'Drupal'
    }

    // Shopify
    if (content.includes('shopify') || headers['x-shopid']) {
        return 'Shopify'
    }

    // Wix
    if (content.includes('wix.com') || headers['x-wix-request-id']) {
        return 'Wix'
    }

    // Next.js
    if (headers['x-powered-by']?.includes('Next.js')) {
        return 'Next.js'
    }

    // React
    if (content.includes('react') || headers['x-react']) {
        return 'React'
    }

    // Static/Other
    return headers['x-powered-by'] || 'Unknown'
}
