import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'

/**
 * System Health API
 * Returns comprehensive system status for monitoring
 * 
 * Usage: GET /api/system/health
 */
export async function GET() {
    try {
        const now = new Date()

        // 1. Get domain counts by status
        let domainCounts = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }

        try {
            const domainStats = await prisma.domain.groupBy({
                by: ['status'],
                _count: { id: true }
            })

            domainStats.forEach(stat => {
                const status = stat.status.toLowerCase()
                if (domainCounts.hasOwnProperty(status)) {
                    domainCounts[status] = stat._count.id
                }
                domainCounts.total += stat._count.id
            })
        } catch (e) {
            console.error('Domain stats error:', e.message)
        }

        // 2. Get submission stats
        let submissions = { success: 0, failed: 0, total: 0 }

        try {
            const submissionStats = await prisma.submissionLog.groupBy({
                by: ['status'],
                _count: { id: true }
            })

            submissionStats.forEach(stat => {
                if (stat.status === 'SUCCESS') submissions.success = stat._count.id
                if (stat.status === 'FAILED') submissions.failed = stat._count.id
                submissions.total += stat._count.id
            })
        } catch (e) {
            console.error('Submission stats error:', e.message)
        }

        // 3. Get recent campaign activity
        let activeCampaigns = 0
        let recentCampaigns = []

        try {
            activeCampaigns = await prisma.campaign.count({
                where: { status: 'RUNNING' }
            })

            recentCampaigns = await prisma.campaign.findMany({
                take: 5,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    updatedAt: true,
                    totalDomains: true,
                    processedDomains: true
                }
            })
        } catch (e) {
            console.error('Campaign stats error:', e.message)
        }

        // 4. Get recent errors (from failed domains)
        let recentErrors = []

        try {
            recentErrors = await prisma.domain.findMany({
                where: {
                    status: 'FAILED',
                    errorMessage: { not: null }
                },
                take: 10,
                orderBy: { updatedAt: 'desc' },
                select: {
                    url: true,
                    errorMessage: true,
                    updatedAt: true
                }
            })
        } catch (e) {
            console.error('Error log fetch error:', e.message)
        }

        // 5. Get recent submissions
        let recentSubmissions = []

        try {
            recentSubmissions = await prisma.submissionLog.findMany({
                take: 20,
                orderBy: { submittedAt: 'desc' },
                select: {
                    type: true,
                    status: true,
                    responseMessage: true,
                    submittedAt: true,
                    page: { select: { url: true } }
                }
            })
        } catch (e) {
            console.error('Submission log fetch error:', e.message)
        }

        // 6. Determine overall health status
        let healthStatus = 'HEALTHY'
        let healthMessage = 'All systems operational'

        if (domainCounts.pending > 0 && domainCounts.processing === 0) {
            healthStatus = 'WARNING'
            healthMessage = 'Pending domains but no active processing - workers may be idle'
        }

        if (submissions.total > 10 && submissions.success === 0) {
            healthStatus = 'CRITICAL'
            healthMessage = 'No successful submissions - check worker logs'
        }

        const successRate = submissions.total > 0
            ? Math.round((submissions.success / submissions.total) * 100)
            : 0

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            health: {
                status: healthStatus,
                message: healthMessage,
                successRate: `${successRate}%`
            },
            domains: domainCounts,
            submissions: submissions,
            processing: {
                activeCampaigns,
                pendingDomains: domainCounts.pending
            },
            recentCampaigns: recentCampaigns.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                progress: `${c.processedDomains}/${c.totalDomains}`,
                lastActivity: c.updatedAt
            })),
            recentErrors: recentErrors.map(e => ({
                domain: e.url,
                error: e.errorMessage,
                time: e.updatedAt
            })),
            recentSubmissions: recentSubmissions.map(s => ({
                url: s.page?.url || 'Unknown',
                type: s.type,
                status: s.status,
                message: s.responseMessage?.substring(0, 100),
                time: s.submittedAt
            }))
        })

    } catch (error) {
        console.error('Health check error:', error)

        return NextResponse.json({
            success: false,
            timestamp: new Date().toISOString(),
            health: {
                status: 'ERROR',
                message: `Health check failed: ${error.message}`
            },
            error: error.message
        }, { status: 500 })
    }
}
