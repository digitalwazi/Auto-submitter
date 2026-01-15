#!/usr/bin/env node

/**
 * Direct Submit Worker
 * 
 * Processes PageDiscovery entries from DIRECT_SUBMIT campaigns
 * WITHOUT crawling - just directly attempts form/comment submission.
 * 
 * Much faster than domain processing.
 */

import { prisma } from '../lib/db.js'
import { submitForm } from '../lib/automation/form-submitter.js'
import { submitComment } from '../lib/automation/comment-submitter.js'

const POLL_INTERVAL = 2000 // Check every 2 seconds
const BATCH_SIZE = 4 // Process 4 URLs in parallel

console.log('🚀 Direct Submit Worker Started')
console.log(`⚙️  Poll Interval: ${POLL_INTERVAL}ms`)
console.log(`⚙️  Batch Size: ${BATCH_SIZE} parallel URLs`)
console.log('---')

let urlsProcessed = 0
let successCount = 0
let failCount = 0

async function processNextPage() {
    try {
        // Find a pending page from a DIRECT_SUBMIT campaign
        const page = await prisma.pageDiscovery.findFirst({
            where: {
                campaign: {
                    processingMode: 'DIRECT_SUBMIT',
                    status: 'RUNNING'
                },
                // Pages that haven't been processed yet (no submission logs)
                submissions: {
                    none: {}
                }
            },
            include: {
                campaign: true
            },
            orderBy: {
                discoveredAt: 'asc'
            }
        })

        if (!page) {
            return false // No pages to process
        }

        const campaign = page.campaign
        const url = page.url

        console.log(`\n📄 Processing: ${url}`)

        // Parse config
        let config = {}
        try {
            config = JSON.parse(campaign.config || '{}')
        } catch (e) { }

        let formSuccess = false
        let commentSuccess = false
        let formMessage = ''
        let commentMessage = ''

        // Try form submission if enabled
        if (campaign.submitForms) {
            try {
                console.log(`   📝 Attempting form submission...`)
                const result = await submitForm(
                    url,
                    null, // Auto-detect form
                    {
                        name: campaign.senderName || 'Anonymous',
                        email: campaign.senderEmail || 'contact@example.com',
                        message: campaign.messageTemplate || 'Hello, I am interested in your services!',
                    },
                    {
                        screenshots: config.saveScreenshots !== false,
                        skipDuplicates: config.skipDuplicates !== false,
                        campaignId: campaign.id,
                    }
                )

                formSuccess = result.success
                formMessage = result.message

                // Log form submission
                await prisma.submissionLog.create({
                    data: {
                        campaignId: campaign.id,
                        pageId: page.id,
                        type: 'FORM',
                        status: result.success ? 'SUCCESS' : 'FAILED',
                        responseMessage: result.message,
                        screenshotUrl: result.screenshots?.after?.path || null,
                    }
                })

                console.log(`   ${result.success ? '✅' : '❌'} Form: ${result.message}`)

            } catch (error) {
                formMessage = error.message
                console.log(`   ❌ Form error: ${error.message}`)

                await prisma.submissionLog.create({
                    data: {
                        campaignId: campaign.id,
                        pageId: page.id,
                        type: 'FORM',
                        status: 'FAILED',
                        responseMessage: error.message,
                    }
                })
            }
        }

        // Try comment submission if enabled
        if (campaign.submitComments) {
            try {
                console.log(`   💬 Attempting comment submission...`)
                const result = await submitComment(
                    url,
                    null, // Auto-detect comment form
                    {
                        name: campaign.senderName || 'Anonymous',
                        email: campaign.senderEmail || 'contact@example.com',
                        message: campaign.messageTemplate || 'Great content! Thanks for sharing.',
                    }
                )

                commentSuccess = result.success
                commentMessage = result.message

                // Log comment submission
                await prisma.submissionLog.create({
                    data: {
                        campaignId: campaign.id,
                        pageId: page.id,
                        type: 'COMMENT',
                        status: result.success ? 'SUCCESS' : 'FAILED',
                        responseMessage: result.message,
                    }
                })

                console.log(`   ${result.success ? '✅' : '❌'} Comment: ${result.message}`)

            } catch (error) {
                commentMessage = error.message
                console.log(`   ❌ Comment error: ${error.message}`)

                await prisma.submissionLog.create({
                    data: {
                        campaignId: campaign.id,
                        pageId: page.id,
                        type: 'COMMENT',
                        status: 'FAILED',
                        responseMessage: error.message,
                    }
                })
            }
        }

        // Update page with results
        await prisma.pageDiscovery.update({
            where: { id: page.id },
            data: {
                hasForm: formSuccess || formMessage !== '',
                hasComments: commentSuccess || commentMessage !== '',
                title: formSuccess || commentSuccess ? 'SUCCESS' : 'FAILED',
            }
        })

        // Update counters
        urlsProcessed++
        if (formSuccess || commentSuccess) {
            successCount++
        } else {
            failCount++
        }

        // Update campaign progress
        await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
                processedDomains: { increment: 1 },
                formsSubmitted: formSuccess ? { increment: 1 } : undefined,
                commentsSubmitted: commentSuccess ? { increment: 1 } : undefined,
            }
        })

        // Check if campaign is complete
        const pendingPages = await prisma.pageDiscovery.count({
            where: {
                campaignId: campaign.id,
                submissions: { none: {} }
            }
        })

        if (pendingPages === 0) {
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: 'COMPLETED' }
            })
            console.log(`🎉 Campaign ${campaign.name} COMPLETED!`)
        }

        return true

    } catch (error) {
        console.error('❌ Worker error:', error.message)
        return false
    }
}

async function processNextBatch() {
    const results = await Promise.allSettled(
        Array(BATCH_SIZE).fill().map(() => processNextPage())
    )

    const processed = results.filter(r => r.status === 'fulfilled' && r.value === true).length
    const noWork = results.filter(r => r.status === 'fulfilled' && r.value === false).length

    if (processed > 0) {
        console.log(`\n✅ Batch: ${processed} URLs processed (Total: ${urlsProcessed}, Success: ${successCount}, Failed: ${failCount})`)
    }

    if (noWork === BATCH_SIZE) {
        // All workers returned false = no URLs to process
        // Check less frequently when idle
        return false
    }

    return true
}

// Main worker loop
async function startWorker() {
    console.log('🔄 Worker loop starting...\n')

    while (true) {
        const hadWork = await processNextBatch()

        // Wait before next poll (shorter if we had work, longer if idle)
        const waitTime = hadWork ? POLL_INTERVAL : POLL_INTERVAL * 3
        await new Promise(resolve => setTimeout(resolve, waitTime))
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n⏹️  SIGTERM received, shutting down...')
    console.log(`📊 Final Stats: ${urlsProcessed} URLs, ${successCount} success, ${failCount} failed`)
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('\n⏹️  SIGINT received, shutting down...')
    console.log(`📊 Final Stats: ${urlsProcessed} URLs, ${successCount} success, ${failCount} failed`)
    process.exit(0)
})

// Start the worker
startWorker().catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
})
