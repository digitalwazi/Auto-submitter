import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
    try {
        // Get PM2 list
        const { stdout } = await execAsync('pm2 jlist')
        const processes = JSON.parse(stdout)

        // Filter for the correct worker defined in ecosystem.config.cjs
        const workers = processes.filter(p => p.name === 'auto-submitter-worker')

        return NextResponse.json({
            success: true,
            running: workers.length > 0 && workers[0].pm2_env.status === 'online',
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
        const { action } = body

        if (action === 'start') {
            // Restart the existing managed process instead of spawning new ones
            await execAsync('pm2 start auto-submitter-worker')
        } else if (action === 'stop') {
            await execAsync('pm2 stop auto-submitter-worker')
        } else if (action === 'scale') {
            // SQLite does not support scaling. Ignore or restart.
            // Just ensure it is running 1 instance.
            await execAsync('pm2 start auto-submitter-worker')
        }

        return NextResponse.json({ success: true, message: `Action ${action} executed` })
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
