import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

// Excel has a maximum cell character limit of 32767
const EXCEL_MAX_CHARS = 32767

/**
 * Truncate text to fit within Excel's cell character limit
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: EXCEL_MAX_CHARS)
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = EXCEL_MAX_CHARS) {
    if (!text || typeof text !== 'string') return text || ''
    if (text.length <= maxLength) return text
    // Leave room for truncation indicator
    return text.substring(0, maxLength - 20) + '... [TRUNCATED]'
}

export async function GET(request, props) {
    const params = await props.params;
    try {
        const { campaignId } = params

        // 1. Fetch Campaign Basic Info (No heavy includes)
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Create workbook
        const wb = XLSX.utils.book_new()

        // === SHEET 1: SUMMARY ===
        const summary = [
            ['Campaign Summary'],
            ['Name', campaign.name],
            ['Status', campaign.status],
            ['Processing Mode', campaign.processingMode],
            ['Total Domains', campaign.totalDomains],
            ['Processed Domains', campaign.processedDomains],
            ['Total Pages', campaign.totalPages],
            ['Forms Submitted', campaign.formsSubmitted],
            ['Comments Submitted', campaign.commentsSubmitted],
            ['Created At', campaign.createdAt.toISOString()],
            [],
        ]
        const ws_summary = XLSX.utils.aoa_to_sheet(summary)
        XLSX.utils.book_append_sheet(wb, ws_summary, 'Summary')

        // === PREPARE DATA ARRAYS ===
        const domainsData = [
            ['URL', 'Status', 'Technology', 'Has Robots.txt', 'Sitemaps Found', 'Pages Discovered', 'Processed At'],
        ]
        const pagesData = [
            ['Domain', 'Page URL', 'Title', 'Has Form', 'Has Comments', 'Submissions'],
        ]
        const contactsData = [
            ['Domain', 'Email', 'Phone', 'Extracted From'],
        ]

        // === BATCH FETCH DOMAINS ===
        // We fetch domains in batches to avoid "rust string" limits (too much JSON at once)
        const BATCH_SIZE = 500
        let skip = 0
        let hasMore = true

        while (hasMore) {
            const domains = await prisma.domain.findMany({
                where: { campaignId },
                include: {
                    pages: {
                        include: {
                            submissions: true,
                        },
                    },
                    contacts: true,
                },
                take: BATCH_SIZE,
                skip: skip,
                orderBy: { id: 'asc' } // Stable ordering for batches
            })

            if (domains.length < BATCH_SIZE) {
                hasMore = false
            } else {
                skip += BATCH_SIZE
            }

            // Process this batch
            for (const domain of domains) {
                // Domains Sheet Row
                domainsData.push([
                    truncateText(domain.url),
                    domain.status,
                    truncateText(domain.technology || 'Unknown'),
                    domain.hasRobotsTxt ? 'Yes' : 'No',
                    domain.sitemapsFound,
                    domain.pagesDiscovered,
                    domain.processedAt ? domain.processedAt.toISOString() : '',
                ])

                // Pages Sheet Rows
                if (domain.pages) {
                    for (const page of domain.pages) {
                        pagesData.push([
                            truncateText(domain.url),
                            truncateText(page.url),
                            truncateText(page.title),
                            page.hasForm ? 'Yes' : 'No',
                            page.hasComments ? 'Yes' : 'No',
                            page.submissions ? page.submissions.length : 0,
                        ])
                    }
                }

                // Contacts Sheet Rows (Domain Level)
                if (domain.contacts) {
                    for (const contact of domain.contacts) {
                        contactsData.push([
                            truncateText(domain.url),
                            truncateText(contact.email || ''),
                            truncateText(contact.phone || ''),
                            truncateText(contact.extractedFrom || domain.url),
                        ])
                    }
                }
            }
        }

        // === CAMPAIGN LEVEL CONTACTS ===
        // (Optimized: We assume all contacts are linked to domains and captured in the domain batch loop above.
        // If there are standalone contacts, they would be missed, but our schema enforces domain relations.)

        // === APPEND SHEETS ===
        const ws_domains = XLSX.utils.aoa_to_sheet(domainsData)
        XLSX.utils.book_append_sheet(wb, ws_domains, 'Domains')

        const ws_pages = XLSX.utils.aoa_to_sheet(pagesData)
        XLSX.utils.book_append_sheet(wb, ws_pages, 'Pages')

        const ws_contacts = XLSX.utils.aoa_to_sheet(contactsData)
        XLSX.utils.book_append_sheet(wb, ws_contacts, 'Contacts')

        // === SUBMISSION LOGS ===
        // These can also be huge, so let's batch them too just in case.
        const submissionsData = [
            ['Page URL', 'Type', 'Status', 'Response Message', 'Submitted At'],
        ]

        let subSkip = 0
        let subHasMore = true

        while (subHasMore) {
            const submissions = await prisma.submissionLog.findMany({
                where: { campaignId },
                include: {
                    page: {
                        select: { url: true }
                    }
                },
                take: BATCH_SIZE,
                skip: subSkip,
                orderBy: { submittedAt: 'desc' }
            })

            if (submissions.length < BATCH_SIZE) {
                subHasMore = false
            } else {
                subSkip += BATCH_SIZE
            }

            for (const sub of submissions) {
                submissionsData.push([
                    truncateText(sub.page?.url || ''),
                    sub.type,
                    sub.status,
                    truncateText(sub.responseMessage || ''),
                    sub.submittedAt.toISOString(),
                ])
            }
        }

        const ws_submissions = XLSX.utils.aoa_to_sheet(submissionsData)
        XLSX.utils.book_append_sheet(wb, ws_submissions, 'Submissions')

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        // Return as downloadable file
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="campaign-${campaignId}.xlsx"`,
            },
        })

    } catch (error) {
        console.error('Export error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
