import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/queue/processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request) {
    try {
        const body = await request.json()
        const { maxTasks = 20, maxTimeSeconds = 240 } = body

        console.log('Manual processing started')

        const result = await processQueue(maxTasks, maxTimeSeconds)

        return NextResponse.json({
            success: true,
            ...result,
        })

    } catch (error) {
        console.error('Manual processing error:', error)

        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
