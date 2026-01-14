#!/usr/bin/env node
/**
 * Watchdog Script - Auto-detects and fixes stuck domains
 * Runs every 5 minutes to check for domains stuck in PROCESSING
 * 
 * Usage: node watchdog.mjs
 * Or run via PM2: pm2 start watchdog.mjs --name watchdog
 */

import { prisma } from './lib/db.js'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const STUCK_THRESHOLD_MINUTES = 10 // Consider stuck if PROCESSING for more than 10 minutes

console.log('🐕 Watchdog Started')
console.log(`   Check interval: ${CHECK_INTERVAL / 60000} minutes`)
console.log(`   Stuck threshold: ${STUCK_THRESHOLD_MINUTES} minutes`)
console.log('---')

async function checkAndFixStuckDomains() {
    try {
        const now = new Date()
        const thresholdTime = new Date(now.getTime() - STUCK_THRESHOLD_MINUTES * 60 * 1000)

        // Find domains stuck in PROCESSING for too long
        const stuckDomains = await prisma.domain.findMany({
            where: {
                status: 'PROCESSING',
                updatedAt: {
                    lt: thresholdTime
                }
            },
            select: {
                id: true,
                url: true,
                updatedAt: true
            }
        })

        if (stuckDomains.length > 0) {
            console.log(`\n⚠️ [${now.toISOString()}] Found ${stuckDomains.length} stuck domains`)

            // Reset stuck domains to PENDING
            const resetResult = await prisma.domain.updateMany({
                where: {
                    status: 'PROCESSING',
                    updatedAt: {
                        lt: thresholdTime
                    }
                },
                data: {
                    status: 'PENDING',
                    errorMessage: `Reset by watchdog (stuck since ${thresholdTime.toISOString()})`
                }
            })

            console.log(`✅ Reset ${resetResult.count} domains from PROCESSING to PENDING`)

            // Log some examples
            stuckDomains.slice(0, 3).forEach(d => {
                const stuckMinutes = Math.round((now.getTime() - new Date(d.updatedAt).getTime()) / 60000)
                console.log(`   - ${d.url} (stuck for ${stuckMinutes} min)`)
            })

            if (stuckDomains.length > 3) {
                console.log(`   ... and ${stuckDomains.length - 3} more`)
            }
        } else {
            // Quiet log for normal operation
            const stats = await prisma.domain.groupBy({
                by: ['status'],
                _count: { id: true }
            })

            const counts = {}
            stats.forEach(s => { counts[s.status] = s._count.id })

            console.log(`✓ [${now.toISOString()}] No stuck domains. Status: PENDING=${counts.PENDING || 0}, PROCESSING=${counts.PROCESSING || 0}, COMPLETED=${counts.COMPLETED || 0}`)
        }

    } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] Watchdog error:`, error.message)
    }
}

// Run immediately on start
checkAndFixStuckDomains()

// Then run every CHECK_INTERVAL
setInterval(checkAndFixStuckDomains, CHECK_INTERVAL)

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('\n⏹️ Watchdog shutting down...')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('\n⏹️ Watchdog shutting down...')
    process.exit(0)
})
