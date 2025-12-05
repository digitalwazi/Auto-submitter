import { NextResponse } from 'next/server'
import { analyzeDomain } from '@/lib/crawler/domain-analyzer'
import { crawlPages } from '@/lib/crawler/page-crawler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
    try {
        const { url, maxPages = 5 } = await request.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        console.log(`Testing URL: ${url}`)

        // Analyze domain
        const domainAnalysis = await analyzeDomain(url)

        // Crawl pages
        const pages = await crawlPages(url, {
            maxPages: Math.min(maxPages, 10), // Limit to 10 for testing
            robots: domainAnalysis.robots,
            initialUrls: domainAnalysis.urls.slice(0, 20),
        })

        // Calculate stats
        const pagesWithForms = pages.filter(p => p.hasForm).length
        const pagesWithComments = pages.filter(p => p.hasComments).length
        const totalContacts = pages.filter(p => p.contacts.email || p.contacts.phone).length

        return NextResponse.json({
            success: true,
            domainAnalysis: {
                robotsTxt: !!domainAnalysis.robotsTxt,
                sitemaps: domainAnalysis.sitemaps,
                urls: domainAnalysis.urls.slice(0, 10), // Show first 10
            },
            pages,
            pagesWithForms,
            pagesWithComments,
            totalContacts,
            message: 'Test completed successfully! No data was saved.',
        })

    } catch (error) {
        console.error('Test error:', error)
        return NextResponse.json({
            error: error.message,
        }, { status: 500 })
    }
}
