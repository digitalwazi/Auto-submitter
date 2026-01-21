import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// In-memory store for restart settings (persists until PM2 restart)
let restartSettings = {
    enabled: false,
    intervalMinutes: 30,
    intervalId: null
}

// Restart all workers
async function restartWorkers() {
    try {
        console.log(`⏰ [Auto-Restart] Restarting PM2 workers...`)
        await execAsync('pm2 restart auto-submitter-worker')
        console.log(`✅ [Auto-Restart] Workers restarted at ${new Date().toISOString()}`)
        return true
    } catch (error) {
        console.error(`❌ [Auto-Restart] Failed:`, error.message)
        return false
    }
}

// Start the restart timer
function startRestartTimer(minutes) {
    // Clear existing timer
    if (restartSettings.intervalId) {
        clearInterval(restartSettings.intervalId)
    }

    const intervalMs = minutes * 60 * 1000
    restartSettings.intervalId = setInterval(restartWorkers, intervalMs)
    restartSettings.enabled = true
    restartSettings.intervalMinutes = minutes

    console.log(`🕐 [Auto-Restart] Timer started: Every ${minutes} minutes`)
}

// Stop the restart timer
function stopRestartTimer() {
    if (restartSettings.intervalId) {
        clearInterval(restartSettings.intervalId)
        restartSettings.intervalId = null
    }
    restartSettings.enabled = false
    console.log(`🛑 [Auto-Restart] Timer stopped`)
}

// GET - Return current restart settings
export async function GET() {
    return NextResponse.json({
        success: true,
        enabled: restartSettings.enabled,
        intervalMinutes: restartSettings.intervalMinutes
    })
}

// POST - Update restart settings
export async function POST(request) {
    try {
        const body = await request.json()
        const { action, intervalMinutes } = body

        if (action === 'enable') {
            const minutes = parseInt(intervalMinutes) || 30
            if (minutes < 5 || minutes > 120) {
                return NextResponse.json({
                    success: false,
                    error: 'Interval must be between 5 and 120 minutes'
                }, { status: 400 })
            }
            startRestartTimer(minutes)
            return NextResponse.json({
                success: true,
                message: `Auto-restart enabled: Every ${minutes} minutes`,
                enabled: true,
                intervalMinutes: minutes
            })
        } else if (action === 'disable') {
            stopRestartTimer()
            return NextResponse.json({
                success: true,
                message: 'Auto-restart disabled',
                enabled: false,
                intervalMinutes: restartSettings.intervalMinutes
            })
        } else if (action === 'restart-now') {
            const result = await restartWorkers()
            return NextResponse.json({
                success: result,
                message: result ? 'Workers restarted' : 'Restart failed'
            })
        } else {
            return NextResponse.json({
                success: false,
                error: 'Invalid action. Use: enable, disable, restart-now'
            }, { status: 400 })
        }
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
