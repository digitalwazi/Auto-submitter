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

        // Create domain records in batches for large uploads (prevents 500 errors with 10K+ domains)
        const BATCH_SIZE = 200
        let domainsCreated = 0

        console.log(`📦 Starting batched insertion of ${domains.length} domains...`)

        for (let i = 0; i < domains.length; i += BATCH_SIZE) {
            const batch = domains.slice(i, i + BATCH_SIZE)

            try {
                await prisma.domain.createMany({
                    data: batch.map(url => ({
                        campaignId,
                        url,
                        status: 'PENDING',
                    })),
                })

                domainsCreated += batch.length

                // Log progress for large uploads
                if (domains.length > 1000 && domainsCreated % 1000 === 0) {
                    console.log(`📦 Created ${domainsCreated}/${domains.length} domains...`)
                }

                // Yield to prevent blocking (important for large uploads)
                if (domains.length > 1000) {
                    await new Promise(resolve => setTimeout(resolve, 50))
                }
            } catch (error) {
                console.error(`Failed to create batch at index ${i}:`, error.message)
            }
        }

        console.log(`✅ Finished inserting ${domainsCreated} domains`)

        return NextResponse.json({
            success: true,
            blobUrl: blob.url,
            domainsCreated,
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json({
            error: error.message,
        }, { status: 500 })
    }
}
