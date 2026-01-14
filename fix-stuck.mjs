#!/usr/bin/env node
/**
 * Reset stuck domains and restart processing
 */

import { resetStuckDomains } from './lib/queue/domain-processor.js'
import { prisma } from './lib/db.js'

async function fixStuckDomains() {
    console.log('🔧 Fixing stuck domains...')

    // Get current counts
    const before = await prisma.domain.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    console.log('Status before fix:', before)

    // Reset stuck domains
    const result = await resetStuckDomains()
    console.log('Reset result:', result)

    // Get counts after
    const after = await prisma.domain.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    console.log('Status after fix:', after)

    console.log('✅ Done!')
    process.exit(0)
}

fixStuckDomains().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
