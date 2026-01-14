import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Get campaign details
// Get campaign details
export async function GET(request, props) {
    const params = await props.params;
    try {
        const { id } = params
        console.log(`🔍 API fetching campaign: ${id}`)

        const campaign = await prisma.campaign.findUnique({
            where: { id },
        })

        if (!campaign) {
            console.error(`❌ Campaign ${id} NOT FOUND in DB`)
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get queue stats for real progress calculation based on DOMAINS
        const queueStats = await prisma.domain.groupBy({
            by: ['status'],
            where: { campaignId: id },
            _count: {
                id: true
            }
        })

        const queueCounts = {
            PENDING: 0,
            PROCESSING: 0,
            COMPLETED: 0,
            FAILED: 0
        }

        queueStats.forEach(stat => {
            queueCounts[stat.status] = stat._count.id
        })

        // Fetch logs (paginated)
        const activityLogs = await prisma.processingQueue.findMany({
            where: { campaignId: id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                taskType: true,
                status: true,
                errorMessage: true,
                result: true,
                createdAt: true,
                domain: {
                    select: { url: true }
                }
            }
        })

        return NextResponse.json({
            campaign,
            queueCounts,
            logs: activityLogs
        })

    } catch (error) {
        console.error('Error fetching campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Update campaign
export async function PATCH(request, props) {
    const params = await props.params;
    try {
        const { id } = params
        const body = await request.json()

        const { status, ...updateData } = body

        // If changing status to RUNNING, set startedAt
        if (status === 'RUNNING') {
            updateData.status = status
            updateData.startedAt = new Date()
        } else if (status) {
            updateData.status = status
        }

        // If changing status to COMPLETED or STOPPED, set completedAt
        if (status === 'COMPLETED' || status === 'STOPPED') {
            updateData.completedAt = new Date()
        }

        const campaign = await prisma.campaign.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ campaign })

    } catch (error) {
        console.error('Error updating campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Delete campaign
export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const { id } = params

        await prisma.campaign.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
