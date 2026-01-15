import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

/**
 * Direct Submit API
 * 
 * Accepts exact page URLs and directly attempts form/comment submission
 * WITHOUT crawling. Much faster for bulk URL processing.
 * 
 * POST /api/test/direct-submit
 */
export async function POST(request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')
        const configStr = formData.get('config')
        const config = configStr ? JSON.parse(configStr) : {}

        // Parse URLs from file or text input
        let urls = []

        if (file && file.size > 0) {
            const text = await file.text()
            urls = text
                .split(/[\r\n,]+/)
                .map(u => u.trim())
                .filter(u => u.length > 5 && (u.startsWith('http://') || u.startsWith('https://')))
        }

        if (urls.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'No valid URLs found. Each URL must start with http:// or https://'
            }, { status: 400 })
        }

        // Remove duplicates
        urls = [...new Set(urls)]

        console.log(`📋 Direct Submit: ${urls.length} URLs received`)

        // Create Campaign
        const campaign = await prisma.campaign.create({
            data: {
                name: config.campaignName?.trim() || `Direct Submit ${new Date().toLocaleString()}`,
                status: 'RUNNING',
                processingMode: 'DIRECT_SUBMIT',
                maxPagesPerDomain: 0, // Not used in direct mode
                submitForms: config.submitForms !== false,
                submitComments: config.submitComments !== false,
                messageTemplate: config.message || config.messageTemplate || '',
                senderName: config.senderName || '',
                senderEmail: config.senderEmail || '',
                config: JSON.stringify(config),
                totalDomains: urls.length, // Using this field to store URL count
            }
        })

        // Create a placeholder domain for direct submit (required by schema)
        const placeholderDomain = await prisma.domain.create({
            data: {
                campaignId: campaign.id,
                url: 'direct-submit://placeholder',
                status: 'COMPLETED', // Mark as completed since we're not crawling it
            }
        })

        console.log(`📋 Created placeholder domain: ${placeholderDomain.id}`)

        // Create PageDiscovery entries for each URL (with status PENDING)
        // These will be picked up by the direct-submit worker
        const batchSize = 500
        let created = 0

        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize)

            await prisma.pageDiscovery.createMany({
                data: batch.map(url => ({
                    campaignId: campaign.id,
                    domainId: placeholderDomain.id, // Use placeholder domain ID
                    url: url,
                    hasForm: true, // Assume all URLs might have forms
                    hasComments: true, // Assume all URLs might have comments
                    title: 'Direct Submit',
                }))
            })

            created += batch.length

            // Small delay to prevent DB lock
            await new Promise(r => setTimeout(r, 50))
        }

        console.log(`✅ Created ${created} page entries for direct submission`)

        // Estimate time (much faster than crawling - about 10-15 seconds per URL)
        const secondsPerUrl = 12
        const totalSeconds = Math.ceil(urls.length * secondsPerUrl / 4) // 4 parallel workers
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        let estimatedTime = ''
        if (hours > 0) {
            estimatedTime = `~${hours}h ${minutes}m`
        } else {
            estimatedTime = `~${minutes} minutes`
        }

        return NextResponse.json({
            success: true,
            message: `Started direct submission for ${urls.length} URLs`,
            campaignId: campaign.id,
            urlCount: urls.length,
            estimatedTime,
            mode: 'DIRECT_SUBMIT'
        })

    } catch (error) {
        console.error('Direct Submit Error:', error)
        return NextResponse.json({
            success: false,
            message: `Error: ${error.message}`
        }, { status: 500 })
    }
}
