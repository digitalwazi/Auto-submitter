/**
 * Checkpoint Manager for Resume/Retry Logic
 * 
 * Features:
 * - Save progress after each domain
 * - Resume from last checkpoint on restart
 * - Configurable checkpoint interval
 * - Automatic retry with exponential backoff
 * - State persistence in file system
 */

import { promises as fs } from 'fs'
import path from 'path'

// ============================================================
// CHECKPOINT STORAGE
// ============================================================

const CHECKPOINT_DIR = '.checkpoints'

/**
 * Ensure checkpoint directory exists
 */
async function ensureCheckpointDir() {
    try {
        await fs.mkdir(CHECKPOINT_DIR, { recursive: true })
    } catch (err) {
        // Directory might already exist
    }
}

/**
 * Get checkpoint file path for a campaign
 */
function getCheckpointPath(campaignId) {
    return path.join(CHECKPOINT_DIR, `${campaignId}.json`)
}

// ============================================================
// CHECKPOINT OPERATIONS
// ============================================================

/**
 * Create a new checkpoint
 */
export async function createCheckpoint(campaignId, data) {
    await ensureCheckpointDir()

    const checkpoint = {
        campaignId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        ...data,
    }

    const filePath = getCheckpointPath(campaignId)
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2))

    console.log(`📍 Checkpoint created: ${campaignId}`)
    return checkpoint
}

/**
 * Update existing checkpoint
 */
export async function updateCheckpoint(campaignId, updates) {
    const existing = await loadCheckpoint(campaignId)

    const checkpoint = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
    }

    const filePath = getCheckpointPath(campaignId)
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2))

    return checkpoint
}

/**
 * Load checkpoint
 */
export async function loadCheckpoint(campaignId) {
    try {
        const filePath = getCheckpointPath(campaignId)
        const content = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(content)
    } catch (err) {
        return null
    }
}

/**
 * Delete checkpoint
 */
export async function deleteCheckpoint(campaignId) {
    try {
        const filePath = getCheckpointPath(campaignId)
        await fs.unlink(filePath)
        console.log(`🗑️ Checkpoint deleted: ${campaignId}`)
    } catch (err) {
        // Checkpoint might not exist
    }
}

/**
 * List all checkpoints
 */
export async function listCheckpoints() {
    await ensureCheckpointDir()

    try {
        const files = await fs.readdir(CHECKPOINT_DIR)
        const checkpoints = []

        for (const file of files) {
            if (file.endsWith('.json')) {
                const campaignId = file.replace('.json', '')
                const checkpoint = await loadCheckpoint(campaignId)
                if (checkpoint) {
                    checkpoints.push(checkpoint)
                }
            }
        }

        return checkpoints
    } catch (err) {
        return []
    }
}

// ============================================================
// CAMPAIGN STATE MANAGEMENT
// ============================================================

/**
 * Campaign checkpoint structure
 */
export function createCampaignState(campaignId, domains, config = {}) {
    return {
        campaignId,
        status: 'created',

        // Domain tracking
        totalDomains: domains.length,
        domains: domains.map(d => ({
            url: d,
            status: 'pending',
            attempts: 0,
            lastAttempt: null,
            error: null,
            results: null,
        })),

        // Progress
        currentIndex: 0,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,

        // Stats
        formsFound: 0,
        formsSubmitted: 0,
        commentsFound: 0,
        commentsSubmitted: 0,

        // Config
        config,

        // Timing
        startedAt: null,
        pausedAt: null,
        completedAt: null,
        lastActivityAt: null,
    }
}

/**
 * Save campaign state
 */
export async function saveCampaignState(state) {
    state.lastActivityAt = new Date().toISOString()
    return createCheckpoint(state.campaignId, state)
}

/**
 * Load campaign state
 */
export async function loadCampaignState(campaignId) {
    return loadCheckpoint(campaignId)
}

/**
 * Update domain status in campaign state
 */
export async function updateDomainState(campaignId, domainUrl, updates) {
    const state = await loadCampaignState(campaignId)
    if (!state) return null

    const domainIndex = state.domains.findIndex(d => d.url === domainUrl)
    if (domainIndex === -1) return state

    state.domains[domainIndex] = {
        ...state.domains[domainIndex],
        ...updates,
        lastAttempt: new Date().toISOString(),
    }

    // Update counts
    state.processedCount = state.domains.filter(d =>
        ['completed', 'failed', 'skipped'].includes(d.status)
    ).length
    state.successCount = state.domains.filter(d => d.status === 'completed').length
    state.failedCount = state.domains.filter(d => d.status === 'failed').length
    state.skippedCount = state.domains.filter(d => d.status === 'skipped').length

    return saveCampaignState(state)
}

/**
 * Get next pending domain
 */
export async function getNextPendingDomain(campaignId) {
    const state = await loadCampaignState(campaignId)
    if (!state) return null

    const pending = state.domains.find(d => d.status === 'pending')
    if (pending) {
        state.currentIndex = state.domains.indexOf(pending)
        await saveCampaignState(state)
    }

    return pending || null
}

/**
 * Get domains that need retry
 */
export async function getDomainsForRetry(campaignId, maxAttempts = 3) {
    const state = await loadCampaignState(campaignId)
    if (!state) return []

    return state.domains.filter(d =>
        d.status === 'failed' &&
        d.attempts < maxAttempts
    )
}

// ============================================================
// RETRY LOGIC
// ============================================================

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5)
    return Math.floor(delay + jitter)
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        onRetry = () => { },
    } = options

    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn(attempt)
        } catch (error) {
            lastError = error

            if (attempt < maxAttempts - 1) {
                const delay = calculateBackoff(attempt, baseDelay, maxDelay)
                console.log(`⏳ Retry ${attempt + 1}/${maxAttempts} in ${delay}ms...`)
                onRetry(attempt, error, delay)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }

    throw lastError
}

// ============================================================
// RESUME FUNCTIONALITY
// ============================================================

/**
 * Check if campaign can be resumed
 */
export async function canResume(campaignId) {
    const state = await loadCampaignState(campaignId)
    if (!state) return { canResume: false, reason: 'No checkpoint found' }

    if (state.status === 'completed') {
        return { canResume: false, reason: 'Campaign already completed' }
    }

    if (state.status === 'cancelled') {
        return { canResume: false, reason: 'Campaign was cancelled' }
    }

    const remaining = state.domains.filter(d => d.status === 'pending').length
    const retryable = state.domains.filter(d =>
        d.status === 'failed' && d.attempts < 3
    ).length

    return {
        canResume: remaining > 0 || retryable > 0,
        reason: remaining > 0 ? `${remaining} domains pending` : `${retryable} domains can be retried`,
        state,
        stats: {
            total: state.totalDomains,
            remaining,
            retryable,
            completed: state.successCount,
            failed: state.failedCount - retryable,
        },
    }
}

/**
 * Resume campaign from checkpoint
 */
export async function resumeCampaign(campaignId) {
    const state = await loadCampaignState(campaignId)
    if (!state) {
        throw new Error('No checkpoint found for this campaign')
    }

    // Update status
    state.status = 'running'
    state.pausedAt = null
    state.lastActivityAt = new Date().toISOString()

    await saveCampaignState(state)

    return state
}

/**
 * Pause campaign
 */
export async function pauseCampaign(campaignId) {
    const state = await loadCampaignState(campaignId)
    if (!state) return null

    state.status = 'paused'
    state.pausedAt = new Date().toISOString()

    await saveCampaignState(state)

    return state
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Clean up old checkpoints
 */
export async function cleanupOldCheckpoints(maxAgeDays = 7) {
    const checkpoints = await listCheckpoints()
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const now = Date.now()

    let cleaned = 0

    for (const checkpoint of checkpoints) {
        const age = now - new Date(checkpoint.updatedAt).getTime()
        if (age > maxAgeMs && checkpoint.status === 'completed') {
            await deleteCheckpoint(checkpoint.campaignId)
            cleaned++
        }
    }

    console.log(`🧹 Cleaned up ${cleaned} old checkpoints`)
    return cleaned
}
