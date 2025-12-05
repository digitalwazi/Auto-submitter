import robotsParser from 'robots-parser'
import { parseStringPromise } from 'xml2js'
import RateLimiter from '../utils/rate-limiter.js'
import { normalizeUrl } from '../utils/validators.js'

const rateLimiter = new RateLimiter(1000, 2000)

export async function analyzeDomain(domainUrl) {
    try {
        const baseUrl = new URL(domainUrl).origin

        // Fetch robots.txt
        const robotsData = await fetchRobotsTxt(baseUrl)

        // Discover sitemaps
        const sitemaps = await discoverSitemaps(baseUrl, robotsData.robots)

        // Extract URLs from sitemaps
        const urls = await extractUrlsFromSitemaps(sitemaps, baseUrl)

        return {
            success: true,
            robotsTxt: robotsData.content,
            robots: robotsData.robots,
            sitemaps,
            urls: urls.slice(0, 100), // Limit initial URLs
        }
    } catch (error) {
        console.error(`Domain analysis failed for ${domainUrl}:`, error.message)
        return {
            success: false,
            error: error.message,
            robotsTxt: null,
            robots: null,
            sitemaps: [],
            urls: [],
        }
    }
}

async function fetchRobotsTxt(baseUrl) {
    try {
        await rateLimiter.wait()

        const robotsUrl = `${baseUrl}/robots.txt`
        const response = await fetch(robotsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AutoSubmitter/1.0; +https://example.com/bot)',
            },
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
            return { content: null, robots: null }
        }

        const content = await response.text()
        const robots = robotsParser(robotsUrl, content)

        return { content, robots }
    } catch (error) {
        console.error(`Failed to fetch robots.txt:`, error.message)
        return { content: null, robots: null }
    }
}

async function discoverSitemaps(baseUrl, robots) {
    const sitemaps = new Set()

    // From robots.txt
    if (robots) {
        const robotsSitemaps = robots.getSitemaps()
        robotsSitemaps.forEach(url => sitemaps.add(url))
    }

    // Common sitemap locations
    const commonPaths = [
        '/sitemap.xml',
        '/sitemap_index.xml',
        '/sitemap1.xml',
        '/post-sitemap.xml',
        '/page-sitemap.xml',
    ]

    for (const path of commonPaths) {
        const sitemapUrl = `${baseUrl}${path}`
        if (await checkSitemapExists(sitemapUrl)) {
            sitemaps.add(sitemapUrl)
        }
    }

    return Array.from(sitemaps)
}

async function checkSitemapExists(url) {
    try {
        await rateLimiter.wait()

        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AutoSubmitter/1.0)',
            },
            signal: AbortSignal.timeout(5000),
        })

        return response.ok
    } catch (error) {
        return false
    }
}

async function extractUrlsFromSitemaps(sitemapUrls, baseUrl) {
    const allUrls = new Set()

    for (const sitemapUrl of sitemapUrls) {
        try {
            await rateLimiter.wait()

            const response = await fetch(sitemapUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AutoSubmitter/1.0)',
                },
                signal: AbortSignal.timeout(15000),
            })

            if (!response.ok) continue

            const xml = await response.text()
            const parsed = await parseStringPromise(xml)

            // Check if it's a sitemap index or regular sitemap
            if (parsed.sitemapindex) {
                // Sitemap index - contains links to other sitemaps
                const nestedSitemaps = parsed.sitemapindex.sitemap?.map(s => s.loc[0]) || []
                const nestedUrls = await extractUrlsFromSitemaps(nestedSitemaps.slice(0, 5), baseUrl)
                nestedUrls.forEach(url => allUrls.add(url))
            } else if (parsed.urlset) {
                // Regular sitemap - contains page URLs
                const urls = parsed.urlset.url?.map(u => u.loc[0]) || []
                urls.forEach(url => {
                    const normalized = normalizeUrl(url, baseUrl)
                    if (normalized) allUrls.add(normalized)
                })
            }

            // Limit total URLs to prevent memory issues
            if (allUrls.size > 500) break

        } catch (error) {
            console.error(`Failed to parse sitemap ${sitemapUrl}:`, error.message)
        }
    }

    return Array.from(allUrls)
}

export function canCrawl(url, robots) {
    if (!robots) return true

    const userAgent = 'AutoSubmitter'
    return robots.isAllowed(url, userAgent) !== false
}
