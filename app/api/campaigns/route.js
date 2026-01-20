import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get all campaigns from SQLite
export async function GET() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        domains: true,
                        pages: true,
                        submissions: true,
                        contacts: true,
                    },
                },
            },
        })

        // Add storage type for compatibility with frontend if needed, though mostly irrelevant now
        const enhancedCampaigns = campaigns.map(c => ({ ...c, storageType: 'SQLITE' }))

        return NextResponse.json({ campaigns: enhancedCampaigns })
    } catch (error) {
        console.error('❌ Error fetching campaigns:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Create new campaign
export async function POST(request) {
    try {
        const body = await request.json()

        const {
            name,
            processingMode = 'MANUAL',
            maxPagesPerDomain = 50,
            submitForms = true,
            submitComments = true,
            messageTemplate,
            senderName,
            senderEmail,
            config
        } = body

        // Validation
        if (!name || !messageTemplate || !senderName || !senderEmail) {
            return NextResponse.json({
                error: 'Missing required fields: name, messageTemplate, senderName, senderEmail',
            }, { status: 400 })
        }

        // Create campaign in SQLite
        const campaign = await prisma.campaign.create({
            data: {
                name,
                processingMode,
                maxPagesPerDomain,
                submitForms,
                submitComments,
                messageTemplate,
                senderName,
                senderEmail,
                config // Pass config JSON if present
            },
        })

        return NextResponse.json({
            campaign: { ...campaign, storageType: 'SQLITE' }
        }, { status: 201 })

    } catch (error) {
        console.error('Error creating campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
