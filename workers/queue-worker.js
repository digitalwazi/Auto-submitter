#!/usr/bin/env node

/**
 * Background Worker for Per-Domain Sequential Processing
 * 
 * This worker processes domains COMPLETELY before moving to the next:
 * - Pick a pending domain
 * - Analyze it
 * - Crawl pages
 * - Submit forms/comments
 * - Mark COMPLETED
 * - Move to next domain
 * 
 * Multiple domains are processed in parallel based on BATCH_SIZE.
 */

import { processNextDomain, resetStuckDomains } from '../lib/queue/domain-processor.js'

const POLL_INTERVAL = 3000 // Check every 3 seconds for new domains
const BATCH_SIZE = 10 // Process 10 domains in parallel (High throughput for 16GB RAM)

console.log('🚀 Domain Worker Started (Per-Domain Sequential Mode)')
console.log(`⚙️  Poll Interval: ${POLL_INTERVAL}ms`)
console.log(`⚙️  Batch Size: ${BATCH_SIZE} parallel domains`)
console.log('---')

let domainsProcessed = 0
let errorCount = 0

async function processNextBatch() {
    try {
        // Process multiple domains in parallel
        const results = await Promise.allSettled(
            Array(BATCH_SIZE).fill().map(() => processNextDomain())
        )

        // Count successful processes
        const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length
        const noWork = results.filter(r => r.status === 'fulfilled' && r.value === false).length

        if (successful > 0) {
            domainsProcessed += successful
            console.log(`\n✅ Batch complete: ${successful} domains processed (Total: ${domainsProcessed})`)
        }

        if (noWork === BATCH_SIZE) {
            // All workers returned false = no domains available
            console.log('📭 No pending domains in queue')
        }

        // Count errors
        const errors = results.filter(r => r.status === 'rejected').length
        if (errors > 0) {
            errorCount += errors
            console.log(`❌ ${errors} domains failed (Total errors: ${errorCount})`)
        }

    } catch (error) {
        errorCount++
        console.error('❌ Worker error:', error.message)
    }
}

// Main worker loop
async function startWorker() {
    console.log('🔄 Worker loop starting...\n')

    // Clean up any stuck domains from previous runs
    await resetStuckDomains()

    while (true) {
        await processNextBatch()

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n⏹️  SIGTERM received, shutting down gracefully...')
    console.log(`📊 Final Stats: ${domainsProcessed} domains processed, ${errorCount} errors`)
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('\n⏹️  SIGINT received, shutting down gracefully...')
    console.log(`📊 Final Stats: ${domainsProcessed} domains processed, ${errorCount} errors`)
    process.exit(0)
})

// Start the worker
startWorker().catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
})
