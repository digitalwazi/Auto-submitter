import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
    try {
        const campaignId = params.id
        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '100')
        const after = searchParams.get('after') // For pagination/polling

        const whereClause = {
            campaignId,
        }

        // If 'after' is provided, only get logs after that timestamp
        if (after) {
            whereClause.timestamp = {
                gt: new Date(after)
            }
        }

        const logs = await prisma.campaignLog.findMany({
            where: whereClause,
            orderBy: { timestamp: 'desc' },
            take: limit,
            select: {
                id: true,
                level: true,
                message: true,
                timestamp: true,
                domainId: true,
            }
        })

        // Reverse so oldest is first (terminal style)
        const orderedLogs = logs.reverse()

        return NextResponse.json({
            success: true,
            logs: orderedLogs,
            count: orderedLogs.length,
            latestTimestamp: orderedLogs.length > 0
                ? orderedLogs[orderedLogs.length - 1].timestamp
                : null
        })

    } catch (error) {
        console.error('Error fetching campaign logs:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
