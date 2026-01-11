import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request, props) {
    const params = await props.params;
    try {
        const { campaignId } = params

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                domains: {
                    include: {
                        pages: {
                            include: {
                                submissions: true,
                            },
                        },
                        contacts: true,
                    },
                },
                submissions: true,
                contacts: true,
            },
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Create workbook
        const wb = XLSX.utils.book_new()

        // Summary sheet
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

        // Domains sheet
        const domainsData = [
            ['URL', 'Status', 'Technology', 'Has Robots.txt', 'Sitemaps Found', 'Pages Discovered', 'Processed At'],
        ]

        campaign.domains.forEach(domain => {
            domainsData.push([
                domain.url,
                domain.status,
                domain.technology || 'Unknown',
                domain.hasRobotsTxt ? 'Yes' : 'No',
                domain.sitemapsFound,
                domain.pagesDiscovered,
                domain.processedAt ? domain.processedAt.toISOString() : '',
            ])
        })

        const ws_domains = XLSX.utils.aoa_to_sheet(domainsData)
        XLSX.utils.book_append_sheet(wb, ws_domains, 'Domains')

        // Pages sheet
        const pagesData = [
            ['Domain', 'Page URL', 'Title', 'Has Form', 'Has Comments', 'Submissions'],
        ]

        campaign.domains.forEach(domain => {
            domain.pages.forEach(page => {
                pagesData.push([
                    domain.url,
                    page.url,
                    page.title,
                    page.hasForm ? 'Yes' : 'No',
                    page.hasComments ? 'Yes' : 'No',
                    page.submissions.length,
                ])
            })
        })

        const ws_pages = XLSX.utils.aoa_to_sheet(pagesData)
        XLSX.utils.book_append_sheet(wb, ws_pages, 'Pages')

        // Contacts sheet - collect from both domains and campaign level
        const contactsData = [
            ['Domain', 'Email', 'Phone', 'Extracted From'],
        ]

        // Collect all contacts from domains
        campaign.domains.forEach(domain => {
            if (domain.contacts && domain.contacts.length > 0) {
                domain.contacts.forEach(contact => {
                    contactsData.push([
                        domain.url,
                        contact.email || '',
                        contact.phone || '',
                        contact.extractedFrom || domain.url,
                    ])
                })
            }
        })

        // Also include any campaign-level contacts (fallback)
        campaign.contacts.forEach(contact => {
            const domain = campaign.domains.find(d => d.id === contact.domainId)
            // Avoid duplicates - check if already added
            const exists = contactsData.some(row =>
                row[0] === (domain?.url || '') && row[1] === (contact.email || '')
            )
            if (!exists) {
                contactsData.push([
                    domain?.url || '',
                    contact.email || '',
                    contact.phone || '',
                    contact.extractedFrom,
                ])
            }
        })

        const ws_contacts = XLSX.utils.aoa_to_sheet(contactsData)
        XLSX.utils.book_append_sheet(wb, ws_contacts, 'Contacts')

        // Submissions sheet
        const submissionsData = [
            ['Page URL', 'Type', 'Status', 'Response Message', 'Submitted At'],
        ]

        campaign.submissions.forEach(submission => {
            const page = campaign.domains
                .flatMap(d => d.pages)
                .find(p => p.id === submission.pageId)

            submissionsData.push([
                page?.url || '',
                submission.type,
                submission.status,
                submission.responseMessage || '',
                submission.submittedAt.toISOString(),
            ])
        })

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
