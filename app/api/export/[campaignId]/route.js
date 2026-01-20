import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import ExcelJS from 'exceljs'
import { PassThrough } from 'stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout

const BATCH_SIZE = 500

export async function GET(request, props) {
    const params = await props.params;
    const { campaignId } = params

    // 1. Fetch Campaign Info
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

    // Create a PassThrough stream
    const stream = new PassThrough()

    // Create streaming workbook
    const options = {
        stream: stream,
        useStyles: true,
        useSharedStrings: true
    }
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options)

    // Start processing in background so we can return the stream immediately
    processExport(workbook, campaignId, campaign).catch(err => {
        console.error('Export Stream Error:', err)
        // Note: Can't really send an error to client once stream has started, 
        // but it will close the connection.
    })

    const filename = `campaign-${campaign.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    })
}

async function processExport(workbook, campaignId, campaign) {
    try {
        // === SHEET 1: SUMMARY ===
        const summarySheet = workbook.addWorksheet('Summary')
        summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 25 }, { header: 'Value', key: 'value', width: 50 }]

        summarySheet.addRow({ metric: 'Campaign Name', value: campaign.name }).commit()
        summarySheet.addRow({ metric: 'Status', value: campaign.status }).commit()
        summarySheet.addRow({ metric: 'Created At', value: campaign.createdAt ? campaign.createdAt.toISOString() : '' }).commit()
        summarySheet.addRow({ metric: '', value: '' }).commit()
        summarySheet.addRow({ metric: 'Total Domains', value: campaign._count.domains }).commit()
        summarySheet.addRow({ metric: 'Total Pages', value: campaign._count.pages }).commit()
        summarySheet.addRow({ metric: 'Contacts Found', value: campaign._count.contacts }).commit()
        summarySheet.addRow({ metric: 'Submissions', value: campaign._count.submissions }).commit()
        summarySheet.commit() // Finish sheet

        // === SHEET 2: DOMAINS ===
        const domainSheet = workbook.addWorksheet('Domains')
        domainSheet.columns = [
            { header: 'URL', key: 'url', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Technology', key: 'tech', width: 20 },
            { header: 'Entities', key: 'ent', width: 15 }, // New concise summary
            { header: 'Pages', key: 'pages', width: 10 },
            { header: 'Processed', key: 'processed', width: 20 },
            { header: 'Error', key: 'error', width: 30 }
        ]

        let skip = 0
        while (true) {
            const domains = await prisma.domain.findMany({
                where: { campaignId },
                take: BATCH_SIZE,
                skip: skip,
                orderBy: { id: 'asc' }
            })
            if (domains.length === 0) break

            for (const d of domains) {
                // Determine entities string (e.g. "R, S, F")
                let ent = []
                if (d.hasRobotsTxt) ent.push('R')
                if (d.sitemapsFound > 0) ent.push('S')

                domainSheet.addRow({
                    url: d.url,
                    status: d.status,
                    tech: d.technology,
                    ent: ent.join(','),
                    pages: d.pagesDiscovered,
                    processed: d.processedAt ? d.processedAt.toISOString() : '',
                    error: d.errorMessage
                }).commit()
            }
            skip += BATCH_SIZE
            // Small pause not strictly needed with streams but good for event loop
            await new Promise(r => setTimeout(r, 0))
        }
        domainSheet.commit()

        // === SHEET 3: PAGES ===
        const pageSheet = workbook.addWorksheet('Pages')
        pageSheet.columns = [
            { header: 'Domain', key: 'domain', width: 30 },
            { header: 'Page URL', key: 'url', width: 50 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Features', key: 'feat', width: 15 }, // Form, Comment
            { header: 'Subs', key: 'subs', width: 8 }
        ]

        skip = 0
        while (true) {
            const pages = await prisma.pageDiscovery.findMany({
                where: { campaignId },
                include: {
                    domain: { select: { url: true } },
                    submissions: { select: { id: true } }
                },
                take: BATCH_SIZE,
                skip: skip,
                orderBy: { id: 'asc' }
            })
            if (pages.length === 0) break

            for (const p of pages) {
                let feat = []
                if (p.hasForm) feat.push('Form')
                if (p.hasComments) feat.push('Comm')

                pageSheet.addRow({
                    domain: p.domain?.url || '',
                    url: p.url,
                    title: p.title,
                    feat: feat.join('/'),
                    subs: p.submissions?.length || 0
                }).commit()
            }
            skip += BATCH_SIZE
            await new Promise(r => setTimeout(r, 0))
        }
        pageSheet.commit()

        // === SHEET 4: CONTACTS ===
        const contactSheet = workbook.addWorksheet('Contacts')
        contactSheet.columns = [
            { header: 'Domain', key: 'domain', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 20 },
            { header: 'Source', key: 'source', width: 30 }
        ]

        skip = 0
        while (true) {
            const contacts = await prisma.extractedContact.findMany({
                where: { campaignId },
                include: { domain: { select: { url: true } } },
                take: BATCH_SIZE,
                skip: skip,
                orderBy: { id: 'asc' }
            })
            if (contacts.length === 0) break

            for (const c of contacts) {
                contactSheet.addRow({
                    domain: c.domain?.url,
                    email: c.email,
                    phone: c.phone,
                    source: c.extractedFrom
                }).commit()
            }
            skip += BATCH_SIZE
            await new Promise(r => setTimeout(r, 0))
        }
        contactSheet.commit()

        // === SHEET 5: SUBMISSIONS ===
        const subSheet = workbook.addWorksheet('Submissions')
        subSheet.columns = [
            { header: 'Page URL', key: 'url', width: 40 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Response', key: 'resp', width: 50 },
            { header: 'Date', key: 'date', width: 25 }
        ]

        skip = 0
        while (true) {
            const subs = await prisma.submissionLog.findMany({
                where: { campaignId },
                include: { page: { select: { url: true } } },
                take: BATCH_SIZE,
                skip: skip,
                orderBy: { submittedAt: 'desc' }
            })
            if (subs.length === 0) break

            for (const s of subs) {
                subSheet.addRow({
                    url: s.page?.url,
                    type: s.type,
                    status: s.status,
                    resp: s.responseMessage,
                    date: s.submittedAt ? s.submittedAt.toISOString() : ''
                }).commit()
            }
            skip += BATCH_SIZE
            await new Promise(r => setTimeout(r, 0))
        }
        subSheet.commit()

        // Finalize workbook
        await workbook.commit()
    } catch (error) {
        console.error('Fatal Export Error:', error)
        // If streams are open, try to close cleanly? 
        // Typically PassThrough will verify downstream
    }
}
