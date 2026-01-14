import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function POST(request) {
    try {
        console.log('🚨 SYSTEM RESET TRIGGERED FROM UI 🚨')

        // 1. Delete all database data
        // Order matters for foreign keys
        await prisma.submissionLog.deleteMany({})
        await prisma.campaignLog.deleteMany({})
        await prisma.processingQueue.deleteMany({})

        await prisma.pageDiscovery.deleteMany({})
        await prisma.extractedContact.deleteMany({})

        await prisma.domain.deleteMany({})
        await prisma.campaign.deleteMany({})

        console.log('✅ Database wiped successfully')

        // 2. Restart Workers (PM2)
        // We use PM2 to restart the worker process to clear any in-memory state
        try {
            console.log('🔄 Restarting PM2 processes...')
            // We use 'pm2 restart auto-submitter-worker' specifically, or 'all'
            // We need to be careful not to kill the web server API before returning response?
            // Actually, if we restart 'all', this request might fail to return response.
            // Better to restart 'auto-submitter-worker' first, and maybe 'web' later?
            // Or just return success and THEN restart asynchronously?

            // We will return success first, then trigger restart logic after a short delay
            // But we can restart worker synchronously.
            await execAsync('pm2 restart auto-submitter-worker')
            console.log('✅ Worker process restarted')

            // We don't restart 'web' because it would kill this response.
            // Client can refresh page manually.

        } catch (pm2Error) {
            console.error('⚠️ PM2 Restart Failed (Running locally?):', pm2Error.message)
            // Non-fatal, as DB is wiped anyway
        }

        return NextResponse.json({
            success: true,
            message: 'System successfully reset! Workers restarted.'
        })

    } catch (error) {
        console.error('❌ Reset Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
