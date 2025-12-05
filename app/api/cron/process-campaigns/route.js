import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/queue/processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

export async function GET(request) {
    try {
        // Verify cron secret if configured
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('Cron job started:', new Date().toISOString())

        // Process queue with time limit
        const result = await processQueue(50, 240) // Process up to 50 tasks in 4 minutes

        console.log(`Cron job completed: ${result.tasksProcessed} tasks in ${result.timeElapsed}s`)

        return NextResponse.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        })

    } catch (error) {
        console.error('Cron job error:', error)

        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
