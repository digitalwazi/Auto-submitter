import { detectForms, detectCommentSections } from './detector.js'
import { extractContacts } from './contact-extractor.js'
import { canCrawl } from './domain-analyzer.js'
import { normalizeUrl, isSameDomain } from '../utils/validators.js'
import RateLimiter from '../utils/rate-limiter.js'
import * as cheerio from 'cheerio'

const rateLimiter = new RateLimiter(2000, 4000)

export async function crawlPages(startUrl, options = {}) {
    const {
        maxPages = 50,
        robots = null,
        initialUrls = [],
        onProgress = null, // Optional callback: (message, current, total) => void
    } = options

    const baseUrl = new URL(startUrl).origin
    const visited = new Set()
    const queue = [...new Set([startUrl, ...initialUrls])]
    const results = []

    while (queue.length > 0 && visited.size < maxPages) {
        const currentUrl = queue.shift()

        // Skip if already visited
        if (visited.has(currentUrl)) continue

        // Skip if not allowed by robots.txt
        if (robots && !canCrawl(currentUrl, robots)) {
            console.log(`Skipping ${currentUrl} - disallowed by robots.txt`)
            continue
        }

        // Skip if different domain
        if (!isSameDomain(currentUrl, baseUrl)) continue

        visited.add(currentUrl)

        try {
            const progressMsg = `Crawling: ${currentUrl} (${visited.size}/${maxPages})`
            console.log(progressMsg)

            // Call progress callback if provided
            if (onProgress) {
                onProgress(progressMsg, visited.size, maxPages)
            }

            await rateLimiter.wait()

            const pageData = await crawlSinglePage(currentUrl, baseUrl)

            if (pageData) {
                results.push(pageData)

                // Add new links to queue
                pageData.links.forEach(link => {
                    if (!visited.has(link) && !queue.includes(link)) {
                        queue.push(link)
                    }
                })
            }

        } catch (error) {
            console.error(`Failed to crawl ${currentUrl}:`, error.message)
        }
    }

    return results
}

async function crawlSinglePage(url, baseUrl) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
            return null
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/html')) {
            return null
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        // Extract title
        const title = $('title').text().trim() || $('h1').first().text().trim()

        // Detect forms
        const forms = detectForms(html, url)

        // Detect comment sections
        const comments = detectCommentSections(html, url)

        // Extract contacts
        const contacts = extractContacts(html)

        // Extract internal links
        const links = extractLinks($, url, baseUrl)

        return {
            url,
            title,
            hasForm: forms.length > 0,
            hasComments: comments.length > 0,
            forms,
            comments,
            contacts,
            links,
        }

    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message)
        return null
    }
}

function extractLinks($, pageUrl, baseUrl) {
    const links = new Set()

    $('a[href]').each((i, element) => {
        const href = $(element).attr('href')
        if (!href) return

        // Normalize URL
        const normalizedUrl = normalizeUrl(href, pageUrl)
        if (!normalizedUrl) return

        // Only include same-domain links
        if (isSameDomain(normalizedUrl, baseUrl)) {
            // Remove hash fragments
            const cleanUrl = normalizedUrl.split('#')[0]
            if (cleanUrl) links.add(cleanUrl)
        }
    })

    return Array.from(links)
}
