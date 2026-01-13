#!/usr/bin/env node

/**
 * Background Worker for Queue Processing
 * 
 * This worker continuously processes the queue without needing cron jobs.
 * It runs indefinitely and automatically handles tasks as they come in.
 * 
 * Usage:
 *   node workers/queue-worker.js
 * 
 * For production (Render):
 *   Add to render.yaml as a background worker service
 */

import { processQueue, resetStuckTasks } from '../lib/queue/processor.js'

const POLL_INTERVAL = 5000 // Check every 5 seconds for new tasks
const BATCH_SIZE = 3 // Process 3 tasks in parallel for good speed/stability balance

console.log('🚀 Queue Worker Started')
console.log(`⚙️  Poll Interval: ${POLL_INTERVAL}ms`)
console.log(`⚙️  Batch Size: ${BATCH_SIZE} parallel tasks`)
console.log('---')

let isProcessing = false
let processedCount = 0
let errorCount = 0

async function processNextBatch() {
    if (isProcessing) {
        return // Already processing, skip this cycle
    }

    isProcessing = true

    try {
        // Process multiple tasks in parallel
        const results = await Promise.allSettled(
            Array(BATCH_SIZE).fill().map(() => processQueue())
        )

        // Count successful processes
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length

        if (successful > 0) {
            processedCount += successful
            console.log(`✅ Processed ${successful} tasks (Total: ${processedCount})`)
        }

        // Count errors
        const errors = results.filter(r => r.status === 'rejected').length
        if (errors > 0) {
            errorCount += errors
            console.log(`❌ ${errors} tasks failed (Total errors: ${errorCount})`)
        }

    } catch (error) {
        errorCount++
        console.error('❌ Worker error:', error.message)
    } finally {
        isProcessing = false
    }
}

// Main worker loop
async function startWorker() {
    console.log('🔄 Worker loop starting...\n')

    // Clean up any stuck tasks from previous runs
    await resetStuckTasks()

    while (true) {
        await processNextBatch()

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n⏹️  SIGTERM received, shutting down gracefully...')
    console.log(`📊 Final Stats: ${processedCount} processed, ${errorCount} errors`)
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('\n⏹️  SIGINT received, shutting down gracefully...')
    console.log(`📊 Final Stats: ${processedCount} processed, ${errorCount} errors`)
    process.exit(0)
})

// Start the worker
startWorker().catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
})
