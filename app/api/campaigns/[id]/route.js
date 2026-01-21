import { NextResponse } from 'next/server'
import prisma, { getDbClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Helper to get client based on campaign's storageType
async function getCampaignClient(id) {
    // First try SQLite
    let campaign = await prisma.campaign.findUnique({ where: { id } })
    if (campaign) return { campaign, db: prisma }

    // Try Supabase if not found
    const { getPrismaSupabase } = await import('@/lib/db')
    const supabase = getPrismaSupabase()
    if (supabase) {
        campaign = await supabase.campaign.findUnique({ where: { id } })
        if (campaign) return { campaign, db: supabase }
    }

    return { campaign: null, db: null }
}

// Get campaign details
export async function GET(request, props) {
    const params = await props.params;
    try {
        const { id } = params
        console.log(`🔍 API fetching campaign: ${id}`)

        const { campaign, db } = await getCampaignClient(id)

        if (!campaign || !db) {
            console.error(`❌ Campaign ${id} NOT FOUND in any DB`)
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get queue stats for real progress calculation based on DOMAINS
        const queueStats = await db.domain.groupBy({
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
        const activityLogs = await db.processingQueue.findMany({
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

        const { campaign: existingCampaign, db } = await getCampaignClient(id)
        if (!existingCampaign || !db) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

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

        const campaign = await db.campaign.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ campaign })

    } catch (error) {
        console.error('Error updating campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Delete campaign (CASCADE deletes all related data via Prisma schema)
export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const { id } = params

        const { campaign, db } = await getCampaignClient(id)
        if (!campaign || !db) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        console.log(`🗑️ Deleting campaign ${id} from ${campaign.storageType || 'sqlite'} (cascade will remove all related data)`)

        await db.campaign.delete({
            where: { id },
        })

        return NextResponse.json({ success: true, message: `Campaign and all related data deleted from ${campaign.storageType || 'sqlite'}` })

    } catch (error) {
        console.error('Error deleting campaign:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
