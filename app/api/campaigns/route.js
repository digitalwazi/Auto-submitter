import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Get all campaigns
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

        return NextResponse.json({ campaigns })
    } catch (error) {
        console.error('Error fetching campaigns:', error)
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
        } = body

        // Validation
        if (!name || !messageTemplate || !senderName || !senderEmail) {
            return NextResponse.json({
                error: 'Missing required fields: name, messageTemplate, senderName, senderEmail',
            }, { status: 400 })
        }

        // Create campaign
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
            },
        })

        return NextResponse.json({ campaign }, { status: 201 })

    } catch (error) {
        console.error('Error creating campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
