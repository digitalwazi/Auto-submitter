import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import prisma from '@/lib/db'

export async function POST(request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')
        const campaignId = formData.get('campaignId')

        if (!file || !campaignId) {
            return NextResponse.json({
                error: 'Missing file or campaignId',
            }, { status: 400 })
        }

        // Verify campaign exists
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
        })

        if (!campaign) {
            return NextResponse.json({
                error: 'Campaign not found',
            }, { status: 404 })
        }

        // Read file content
        const fileContent = await file.text()
        const lines = fileContent.split('\n').map(line => line.trim()).filter(Boolean)

        // Validate URLs
        const domains = []
        for (const line of lines) {
            try {
                // Add https:// if no protocol
                let url = line
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`
                }

                const urlObj = new URL(url)
                domains.push(urlObj.origin)
            } catch (error) {
                console.warn(`Invalid URL skipped: ${line}`)
            }
        }

        if (domains.length === 0) {
            return NextResponse.json({
                error: 'No valid domains found in file',
            }, { status: 400 })
        }

        // Store file in Vercel Blob
        const blob = await put(`uploads/${campaignId}/${file.name}`, file, {
            access: 'public',
        })

        // Create domain records
        const created = []
        for (const domainUrl of domains) {
            try {
                const domain = await prisma.domain.create({
                    data: {
                        campaignId,
                        url: domainUrl,
                    },
                })

                // Queue domain analysis task
                await prisma.processingQueue.create({
                    data: {
                        campaignId,
                        domainId: domain.id,
                        taskType: 'ANALYZE_DOMAIN',
                        priority: 10,
                    },
                })

                created.push(domain)
            } catch (error) {
                console.error(`Failed to create domain ${domainUrl}:`, error.message)
            }
        }

        return NextResponse.json({
            success: true,
            blobUrl: blob.url,
            domainsCreated: created.length,
            domains: created,
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json({
            error: error.message,
        }, { status: 500 })
    }
}
