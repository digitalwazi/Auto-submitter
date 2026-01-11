/**
 * Duplicate Detection System
 * 
 * Features:
 * - Track submitted domains in local storage
 * - Check before processing to avoid re-submissions
 * - Option to skip or re-submit duplicates
 * - Cross-campaign deduplication
 * - Configurable duplicate window (time-based)
 */

import { promises as fs } from 'fs'
import path from 'path'

// ============================================================
// STORAGE
// ============================================================

const SUBMISSION_HISTORY_FILE = '.submission-history.json'
let submissionCache = null

/**
 * Load submission history from file
 */
async function loadHistory() {
    if (submissionCache !== null) return submissionCache

    try {
        const content = await fs.readFile(SUBMISSION_HISTORY_FILE, 'utf-8')
        submissionCache = JSON.parse(content)
    } catch (err) {
        submissionCache = {
            submissions: {},
            lastUpdated: null,
        }
    }

    return submissionCache
}

/**
 * Save submission history to file
 */
async function saveHistory() {
    if (!submissionCache) return

    submissionCache.lastUpdated = new Date().toISOString()
    await fs.writeFile(
        SUBMISSION_HISTORY_FILE,
        JSON.stringify(submissionCache, null, 2)
    )
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================

/**
 * Generate a unique key for a submission
 */
export function generateSubmissionKey(domain, formUrl = null, formType = null) {
    // Normalize domain
    const normalizedDomain = normalizeDomain(domain)

    if (formUrl) {
        // Include form URL for form-level deduplication
        const normalizedFormUrl = normalizeUrl(formUrl)
        return `${normalizedDomain}|${normalizedFormUrl}|${formType || 'unknown'}`
    }

    // Domain-level deduplication
    return normalizedDomain
}

/**
 * Normalize domain for comparison
 */
export function normalizeDomain(domain) {
    let normalized = domain.toLowerCase().trim()

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '')

    // Remove www
    normalized = normalized.replace(/^www\./, '')

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '')

    // Remove port
    normalized = normalized.replace(/:\d+$/, '')

    return normalized
}

/**
 * Normalize URL for comparison
 */
export function normalizeUrl(url) {
    try {
        const parsed = new URL(url)
        // Remove query params and hash for comparison
        return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
    } catch (err) {
        return url.toLowerCase().trim()
    }
}

/**
 * Check if a domain/form has been submitted before
 */
export async function isDuplicate(domain, formUrl = null, options = {}) {
    const history = await loadHistory()
    const key = generateSubmissionKey(domain, formUrl)

    const record = history.submissions[key]

    if (!record) {
        return { isDuplicate: false }
    }

    // Check time window if specified
    if (options.windowDays) {
        const windowMs = options.windowDays * 24 * 60 * 60 * 1000
        const recordAge = Date.now() - new Date(record.lastSubmittedAt).getTime()

        if (recordAge > windowMs) {
            return {
                isDuplicate: false,
                reason: 'Outside time window',
                lastSubmission: record,
            }
        }
    }

    return {
        isDuplicate: true,
        reason: 'Previously submitted',
        lastSubmission: record,
        submissionCount: record.count,
    }
}

/**
 * Check multiple domains for duplicates
 */
export async function checkDuplicates(domains, options = {}) {
    const results = {
        unique: [],
        duplicates: [],
    }

    for (const domain of domains) {
        const check = await isDuplicate(domain, null, options)

        if (check.isDuplicate) {
            results.duplicates.push({
                domain,
                ...check,
            })
        } else {
            results.unique.push(domain)
        }
    }

    return results
}

/**
 * Record a submission
 */
export async function recordSubmission(domain, formUrl = null, details = {}) {
    const history = await loadHistory()
    const key = generateSubmissionKey(domain, formUrl, details.formType)

    const existing = history.submissions[key]

    history.submissions[key] = {
        domain: normalizeDomain(domain),
        formUrl: formUrl ? normalizeUrl(formUrl) : null,
        formType: details.formType || null,
        campaignId: details.campaignId || null,

        // Tracking
        firstSubmittedAt: existing?.firstSubmittedAt || new Date().toISOString(),
        lastSubmittedAt: new Date().toISOString(),
        count: (existing?.count || 0) + 1,

        // Status
        lastStatus: details.status || 'submitted',
        lastError: details.error || null,

        // Additional info
        pluginType: details.pluginType || null,
    }

    await saveHistory()

    return history.submissions[key]
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Filter domains list to remove duplicates
 */
export async function filterDuplicates(domains, options = {}) {
    const {
        mode = 'skip', // 'skip' | 'allow' | 'retry-failed'
        windowDays = null,
        onDuplicate = () => { },
    } = options

    if (mode === 'allow') {
        return domains
    }

    const filtered = []
    const history = await loadHistory()

    for (const domain of domains) {
        const check = await isDuplicate(domain, null, { windowDays })

        if (!check.isDuplicate) {
            filtered.push(domain)
        } else if (mode === 'retry-failed' && check.lastSubmission?.lastStatus === 'failed') {
            // Allow retry for failed submissions
            filtered.push(domain)
            onDuplicate(domain, 'retrying-failed', check)
        } else {
            onDuplicate(domain, 'skipped', check)
        }
    }

    return filtered
}

/**
 * Get submission stats
 */
export async function getSubmissionStats() {
    const history = await loadHistory()
    const submissions = Object.values(history.submissions)

    const stats = {
        totalSubmissions: submissions.length,
        totalAttempts: submissions.reduce((sum, s) => sum + s.count, 0),

        byStatus: {},
        byFormType: {},
        byCampaign: {},

        recentSubmissions: [],
    }

    for (const submission of submissions) {
        // By status
        const status = submission.lastStatus || 'unknown'
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1

        // By form type
        const formType = submission.formType || 'unknown'
        stats.byFormType[formType] = (stats.byFormType[formType] || 0) + 1

        // By campaign
        const campaignId = submission.campaignId || 'unknown'
        stats.byCampaign[campaignId] = (stats.byCampaign[campaignId] || 0) + 1
    }

    // Recent submissions (last 10)
    stats.recentSubmissions = submissions
        .sort((a, b) => new Date(b.lastSubmittedAt) - new Date(a.lastSubmittedAt))
        .slice(0, 10)

    return stats
}

/**
 * Clear submission history
 */
export async function clearHistory(options = {}) {
    const history = await loadHistory()

    if (options.campaignId) {
        // Clear only for specific campaign
        for (const key of Object.keys(history.submissions)) {
            if (history.submissions[key].campaignId === options.campaignId) {
                delete history.submissions[key]
            }
        }
    } else if (options.olderThanDays) {
        // Clear older submissions
        const cutoff = Date.now() - (options.olderThanDays * 24 * 60 * 60 * 1000)
        for (const key of Object.keys(history.submissions)) {
            const submittedAt = new Date(history.submissions[key].lastSubmittedAt).getTime()
            if (submittedAt < cutoff) {
                delete history.submissions[key]
            }
        }
    } else {
        // Clear all
        history.submissions = {}
    }

    await saveHistory()

    return { cleared: true }
}

// ============================================================
// EXPORT/IMPORT
// ============================================================

/**
 * Export submission history
 */
export async function exportHistory() {
    const history = await loadHistory()
    return history
}

/**
 * Import submission history
 */
export async function importHistory(data, options = {}) {
    const history = await loadHistory()

    if (options.merge) {
        // Merge with existing
        for (const [key, value] of Object.entries(data.submissions || {})) {
            if (!history.submissions[key] ||
                new Date(value.lastSubmittedAt) > new Date(history.submissions[key].lastSubmittedAt)) {
                history.submissions[key] = value
            }
        }
    } else {
        // Replace
        history.submissions = data.submissions || {}
    }

    await saveHistory()

    return history
}
