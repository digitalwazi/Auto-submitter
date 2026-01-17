import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
    try {
        // Get PM2 list
        const { stdout } = await execAsync('pm2 jlist')
        const processes = JSON.parse(stdout)

        // Filter for queue-workers
        const workers = processes.filter(p => p.name === 'queue-workers')

        return NextResponse.json({
            success: true,
            running: workers.length > 0,
            count: workers.length,
            status: workers.length > 0 ? workers[0].pm2_env.status : 'stopped',
            cpu: workers.reduce((sum, w) => sum + (w.monit?.cpu || 0), 0),
            memory: workers.reduce((sum, w) => sum + (w.monit?.memory || 0), 0)
        })
    } catch (error) {
        // If PM2 is not found or fails (local dev), return mock data
        console.error('PM2 check failed:', error.message)
        return NextResponse.json({
            success: true,
            running: false,
            count: 0,
            status: 'unknown',
            error: error.message
        })
    }
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { action, count } = body

        if (action === 'start') {
            await execAsync('pm2 start workers/queue-worker.js -i 4 --name queue-workers')
        } else if (action === 'stop') {
            await execAsync('pm2 delete queue-workers')
        } else if (action === 'scale' && count) {
            await execAsync(`pm2 scale queue-workers ${count}`)
        }

        return NextResponse.json({ success: true, message: `Action ${action} executed` })
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
