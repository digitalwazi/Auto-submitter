import { NextResponse } from 'next/server'
import { prisma, prismaSupabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get all campaigns from BOTH databases
export async function GET() {
    try {
        const fetchOptions = {
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
        }

        // Parallel fetch
        const [localCampaigns, cloudResults] = await Promise.allSettled([
            prisma.campaign.findMany(fetchOptions),
            prismaSupabase.campaign.findMany(fetchOptions)
        ])

        const campaigns = []

        // Process Local Results
        if (localCampaigns.status === 'fulfilled') {
            localCampaigns.value.forEach(c => {
                campaigns.push({ ...c, storageType: 'SQLITE' })
            })
        } else {
            console.error('❌ Failed to fetch local campaigns:', localCampaigns.reason)
        }

        // Process Cloud Results
        if (cloudResults.status === 'fulfilled') {
            cloudResults.value.forEach(c => {
                campaigns.push({ ...c, storageType: 'SUPABASE' })
            })
        } else {
            console.error('❌ Failed to fetch cloud campaigns:', cloudResults.reason)
        }

        // Sort combined list by date
        campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        return NextResponse.json({ campaigns })
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
            storageType = 'SQLITE', // Default to SQLite if not specified
            config
        } = body

        // Validation
        if (!name || !messageTemplate || !senderName || !senderEmail) {
            return NextResponse.json({
                error: 'Missing required fields: name, messageTemplate, senderName, senderEmail',
            }, { status: 400 })
        }

        // Select Database
        const db = storageType === 'SUPABASE' ? prismaSupabase : prisma

        // Create campaign
        const campaign = await db.campaign.create({
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
            campaign: { ...campaign, storageType }
        }, { status: 201 })

    } catch (error) {
        console.error('Error creating campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
