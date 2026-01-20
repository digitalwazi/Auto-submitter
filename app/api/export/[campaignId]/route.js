import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 500

function escapeCsv(field) {
    if (field === null || field === undefined) return ''
    const stringField = String(field)
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`
    }
    return stringField
}

export async function GET(request, props) {
    const params = await props.params;
    const { campaignId } = params

    // 1. Fetch Campaign Summary
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
            _count: {
                select: {
                    domains: true,
                    pages: true,
                    submissions: true,
                    contacts: true
                }
            }
        }
    })

    if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Write BOM
                controller.enqueue(encoder.encode('\uFEFF'))

                // === SECTION 1: SUMMARY ===
                const summaryRows = [
                    ['CAMPAIGN SUMMARY'],
                    ['Name', campaign.name],
                    ['Status', campaign.status],
                    ['Created At', campaign.createdAt ? campaign.createdAt.toISOString() : ''],
                    ['Total Domains', campaign._count.domains],
                    ['Total Pages', campaign._count.pages],
                    ['Total Contacts', campaign._count.contacts],
                    ['Total Submissions', campaign._count.submissions],
                    [] // Empty line
                ]

                let summaryChunk = ''
                summaryRows.forEach(row => {
                    summaryChunk += row.map(escapeCsv).join(',') + '\n'
                })
                controller.enqueue(encoder.encode(summaryChunk))

                // === SECTION 2: DOMAINS ===
                controller.enqueue(encoder.encode('DOMAINS LIST\n'))
                const domainHeaders = ['URL', 'Status', 'Technology', 'Has Robots', 'Pages Found', 'Processed At', 'Error']
                controller.enqueue(encoder.encode(domainHeaders.join(',') + '\n'))

                let skip = 0
                while (true) {
                    const domains = await prisma.domain.findMany({
                        where: { campaignId },
                        take: BATCH_SIZE,
                        skip: skip,
                        orderBy: { id: 'asc' }
                    })

                    if (domains.length === 0) break

                    let chunk = ''
                    for (const d of domains) {
                        chunk += [
                            d.url,
                            d.status,
                            d.technology || '',
                            d.hasRobotsTxt ? 'Yes' : 'No',
                            d.pagesDiscovered,
                            d.processedAt ? d.processedAt.toISOString() : '',
                            d.errorMessage || ''
                        ].map(escapeCsv).join(',') + '\n'
                    }
                    controller.enqueue(encoder.encode(chunk))
                    skip += BATCH_SIZE
                    await new Promise(r => setTimeout(r, 0))
                }
                controller.enqueue(encoder.encode('\n')) // Spacer

                // === SECTION 3: PAGES (The missing piece) ===
                controller.enqueue(encoder.encode('PAGES DETAIL\n'))
                const pageHeaders = ['Domain URL', 'Page URL', 'Title', 'Has Form', 'Has Comments', 'Submissions Count']
                controller.enqueue(encoder.encode(pageHeaders.join(',') + '\n'))

                skip = 0
                while (true) {
                    const pages = await prisma.pageDiscovery.findMany({
                        where: { campaignId },
                        include: {
                            domain: { select: { url: true } },
                            submissions: { select: { id: true } } // Just to count
                        },
                        take: BATCH_SIZE,
                        skip: skip,
                        orderBy: { id: 'asc' }
                    })

                    if (pages.length === 0) break

                    let chunk = ''
                    for (const p of pages) {
                        // Calc submissions count manually from relation or use _count in newer prisma
                        const subCount = p.submissions ? p.submissions.length : 0

                        chunk += [
                            p.domain?.url || '',
                            p.url,
                            p.title || '',
                            p.hasForm ? 'Yes' : 'No',
                            p.hasComments ? 'Yes' : 'No',
                            subCount
                        ].map(escapeCsv).join(',') + '\n'
                    }
                    controller.enqueue(encoder.encode(chunk))
                    skip += BATCH_SIZE
                    await new Promise(r => setTimeout(r, 0))
                }
                controller.enqueue(encoder.encode('\n'))

                // === SECTION 4: CONTACTS ===
                controller.enqueue(encoder.encode('CONTACTS FOUND\n'))
                const contactHeaders = ['Domain URL', 'Email', 'Phone', 'Source']
                controller.enqueue(encoder.encode(contactHeaders.join(',') + '\n'))

                skip = 0
                while (true) {
                    const contacts = await prisma.extractedContact.findMany({
                        where: { campaignId },
                        include: {
                            domain: { select: { url: true } }
                        },
                        take: BATCH_SIZE,
                        skip: skip,
                        orderBy: { id: 'asc' }
                    })

                    if (contacts.length === 0) break

                    let chunk = ''
                    for (const c of contacts) {
                        chunk += [
                            c.domain?.url || '',
                            c.email || '',
                            c.phone || '',
                            c.extractedFrom || ''
                        ].map(escapeCsv).join(',') + '\n'
                    }
                    controller.enqueue(encoder.encode(chunk))
                    skip += BATCH_SIZE
                    await new Promise(r => setTimeout(r, 0))
                }
                controller.enqueue(encoder.encode('\n'))

                // === SECTION 5: SUBMISSIONS ===
                controller.enqueue(encoder.encode('SUBMISSION LOGS\n'))
                const subHeaders = ['Page URL', 'Type', 'Status', 'Response', 'Submitted At']
                controller.enqueue(encoder.encode(subHeaders.join(',') + '\n'))

                skip = 0
                while (true) {
                    const submissions = await prisma.submissionLog.findMany({
                        where: { campaignId },
                        include: {
                            page: { select: { url: true } }
                        },
                        take: BATCH_SIZE,
                        skip: skip,
                        orderBy: { submittedAt: 'desc' }
                    })

                    if (submissions.length === 0) break

                    let chunk = ''
                    for (const s of submissions) {
                        chunk += [
                            s.page?.url || '',
                            s.type,
                            s.status,
                            s.responseMessage || '',
                            s.submittedAt ? s.submittedAt.toISOString() : ''
                        ].map(escapeCsv).join(',') + '\n'
                    }
                    controller.enqueue(encoder.encode(chunk))
                    skip += BATCH_SIZE
                    await new Promise(r => setTimeout(r, 0))
                }

                controller.close()
            } catch (error) {
                console.error('Streaming export error:', error)
                controller.error(error)
            }
        }
    })

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="campaign-${campaign.id}.csv"`,
            'Cache-Control': 'no-cache',
            'Transfer-Encoding': 'chunked'
        },
    })
}
