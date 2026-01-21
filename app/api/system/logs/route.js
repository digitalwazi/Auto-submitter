import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Get recent PM2 logs
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const lines = searchParams.get('lines') || '50'

        // Get combined logs from all workers
        const { stdout } = await execAsync(`pm2 logs --nostream --lines ${lines} 2>&1`)

        return NextResponse.json({
            success: true,
            logs: stdout,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message,
            logs: `Error fetching logs: ${error.message}`
        })
    }
}
