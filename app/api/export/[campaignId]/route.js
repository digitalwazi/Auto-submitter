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

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { name: true }
    })

    if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Write BOM for Excel UTF-8 compatibility
                controller.enqueue(encoder.encode('\uFEFF'))

                // Write Headers
                const headers = [
                    'URL',
                    'Status',
                    'Technology',
                    'Has Robots.txt',
                    'Pages Found',
                    'Forms Found',
                    'Comments Found',
                    'Emails',
                    'Phones',
                    'Processed At',
                    'Error Message'
                ]
                controller.enqueue(encoder.encode(headers.join(',') + '\n'))

                // Batch Fetch
                let skip = 0
                let hasMore = true

                while (hasMore) {
                    const domains = await prisma.domain.findMany({
                        where: { campaignId },
                        include: {
                            contacts: true,
                            pages: {
                                select: {
                                    hasForm: true,
                                    hasComments: true
                                }
                            }
                        },
                        take: BATCH_SIZE,
                        skip: skip,
                        orderBy: { id: 'asc' }
                    })

                    if (domains.length < BATCH_SIZE) {
                        hasMore = false
                    } else {
                        skip += BATCH_SIZE
                    }

                    let chunk = ''
                    for (const domain of domains) {
                        // Aggregate data
                        const emails = domain.contacts
                            .filter(c => c.email)
                            .map(c => c.email)
                            .join('; ')

                        const phones = domain.contacts
                            .filter(c => c.phone)
                            .map(c => c.phone)
                            .join('; ')

                        const formsCount = domain.pages.filter(p => p.hasForm).length
                        const commentsCount = domain.pages.filter(p => p.hasComments).length

                        const row = [
                            domain.url,
                            domain.status,
                            domain.technology || '',
                            domain.hasRobotsTxt ? 'Yes' : 'No',
                            domain.pagesDiscovered,
                            formsCount,
                            commentsCount,
                            emails,
                            phones,
                            domain.processedAt ? domain.processedAt.toISOString() : '',
                            domain.errorMessage || ''
                        ].map(escapeCsv).join(',')

                        chunk += row + '\n'
                    }

                    // Send chunk
                    controller.enqueue(encoder.encode(chunk))

                    // Small yield to prevent event loop starvation
                    await new Promise(resolve => setTimeout(resolve, 0))
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
            'Content-Disposition': `attachment; filename="campaign-${campaign.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv"`,
            'Cache-Control': 'no-cache',
            'Transfer-Encoding': 'chunked'
        },
    })
}
