import { NextResponse } from 'next/server'
import { analyzeDomain } from '@/lib/crawler/domain-analyzer'
import { crawlPages } from '@/lib/crawler/page-crawler'
import { submitForm } from '@/lib/automation/form-submitter'
import { submitComment } from '@/lib/automation/comment-submitter'

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

                let domainsProcessed = 0
                let pagesFound = 0
                let formsSubmitted = 0
                let commentsPosted = 0

                // Process each domain
                for (const domainUrl of domains) {
                    sendLog(`\n🔍 Processing: ${domainUrl}`, 'info')

                    try {
                        // Step 1: Analyze domain
                        sendLog(`  ↳ Analyzing robots.txt and sitemaps...`)
                        const analysis = await analyzeDomain(domainUrl)
                        sendLog(`  ✓ Found ${analysis.sitemaps.length} sitemaps, ${analysis.urls.length} URLs`)

                        // Step 2: Crawl pages
                        sendLog(`  ↳ Crawling pages (max ${config.maxPages})...`)
                        const pages = await crawlPages(domainUrl, {
                            maxPages: config.maxPages,
                            robots: analysis.robots,
                            initialUrls: analysis.urls.slice(0, 20),
                        })

                        const pagesWithForms = pages.filter(p => p.hasForm)
                        const pagesWithComments = pages.filter(p => p.hasComments)

                        sendLog(`  ✓ Found ${pages.length} pages: ${pagesWithForms.length} forms, ${pagesWithComments.length} comments`)
                        pagesFound += pages.length

                        // Step 3: Submit forms
                        if (config.submitForms) {
                            for (const page of pagesWithForms.slice(0, 2)) { // Limit to 2 per domain
                                sendLog(`  ↳ Submitting form on: ${page.url}`, 'warning')

                                try {
                                    const result = await submitForm(page.url, page.forms[0], {
                                        name: config.senderName,
                                        email: config.senderEmail,
                                        message: config.message,
                                    })

                                    if (result.success) {
                                        sendLog(`    ✅ Form submitted successfully!`, 'success')
                                        formsSubmitted++
                                    } else {
                                        sendLog(`    ⚠ Form submission failed: ${result.message}`, 'warning')
                                    }
                                } catch (error) {
                                    sendLog(`    ❌ Error: ${error.message}`, 'error')
                                }
                            }
                        }

                        // Step 4: Submit comments
                        if (config.submitComments) {
                            for (const page of pagesWithComments.slice(0, 2)) { // Limit to 2 per domain
                                sendLog(`  ↳ Posting comment on: ${page.url}`, 'warning')

                                try {
                                    const result = await submitComment(page.url, page.comments[0], {
                                        name: config.senderName,
                                        email: config.senderEmail,
                                        message: config.message,
                                    })

                                    if (result.success) {
                                        sendLog(`    ✅ Comment posted successfully!`, 'success')
                                        commentsPosted++
                                    } else {
                                        sendLog(`    ⚠ Comment posting failed: ${result.message}`, 'warning')
                                    }
                                } catch (error) {
                                    sendLog(`    ❌ Error: ${error.message}`, 'error')
                                }
                            }
                        }

                        domainsProcessed++
                        sendLog(`✓ Completed: ${domainUrl}\n`, 'success')

                    } catch (error) {
                        sendLog(`❌ Error processing ${domainUrl}: ${error.message}`, 'error')
                    }
                }

                // Send final results
                const results = {
                    domainsProcessed,
                    pagesFound,
                    formsSubmitted,
                    commentsPosted,
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: results })}\n\n`))
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
