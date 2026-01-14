import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request, props) {
    const params = await props.params;
    try {
        const { id } = params

        // Fetch heavy data separately
        const domains = await prisma.domain.findMany({
            where: { campaignId: id },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            // Removed limit as per user request (was take: 1000)
        })

        const contacts = await prisma.extractedContact.findMany({
            where: { campaignId: id },
            orderBy: { createdAt: 'desc' },
            take: 5000
        })

        const pages = await prisma.pageDiscovery.findMany({
            where: { campaignId: id },
            take: 5000
        })

        const submissions = await prisma.submissionLog.findMany({
            where: { campaignId: id },
            orderBy: { submittedAt: 'desc' },
            take: 1000
        })

        return NextResponse.json({
            domains,
            contacts,
            pages,
            submissions
        })

    } catch (error) {
        console.error('Failed to fetch campaign data:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
