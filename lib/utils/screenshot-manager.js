/**
 * Screenshot Manager
 * 
 * Features:
 * - Capture before/after screenshots during form submission
 * - Store in local folder
 * - Associate screenshots with submission records
 * - Thumbnail generation (optional)
 * - Automatic cleanup of old screenshots
 */

import { promises as fs } from 'fs'
import path from 'path'

// ============================================================
// CONFIGURATION
// ============================================================

const SCREENSHOTS_DIR = 'screenshots'
const MAX_SCREENSHOT_AGE_DAYS = 30

// ============================================================
// DIRECTORY MANAGEMENT
// ============================================================

/**
 * Ensure screenshots directory exists
 */
async function ensureScreenshotDir(subDir = null) {
    const dir = subDir ? path.join(SCREENSHOTS_DIR, subDir) : SCREENSHOTS_DIR

    try {
        await fs.mkdir(dir, { recursive: true })
    } catch (err) {
        // Directory might already exist
    }

    return dir
}

/**
 * Generate screenshot filename
 */
function generateFilename(prefix, domain, timestamp = Date.now()) {
    // Sanitize domain for filename
    const safeDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 50)

    return `${prefix}_${safeDomain}_${timestamp}.png`
}

// ============================================================
// SCREENSHOT CAPTURE
// ============================================================

/**
 * Capture a screenshot
 */
export async function captureScreenshot(page, options = {}) {
    const {
        domain = 'unknown',
        type = 'screenshot', // 'before', 'after', 'error', 'success'
        campaignId = null,
        fullPage = false,
        quality = 80,
    } = options

    try {
        const timestamp = Date.now()
        const filename = generateFilename(type, domain, timestamp)

        // Create subdirectory structure: screenshots/campaigns/{campaignId}/
        const subDir = campaignId ? `campaigns/${campaignId}` : 'general'
        const dir = await ensureScreenshotDir(subDir)

        const filepath = path.join(dir, filename)

        // Capture screenshot
        await page.screenshot({
            path: filepath,
            fullPage,
            type: 'png',
            // quality: quality, // quality only works with jpeg
        })

        // Get relative path for storage
        const relativePath = path.relative('.', filepath)

        console.log(`📸 Screenshot saved: ${relativePath}`)

        return {
            success: true,
            path: relativePath,
            filename,
            timestamp,
            type,
            domain,
        }
    } catch (error) {
        console.error(`Failed to capture screenshot: ${error.message}`)

        return {
            success: false,
            error: error.message,
        }
    }
}

/**
 * Capture before and after screenshots for form submission
 */
export async function captureSubmissionScreenshots(page, domain, options = {}) {
    const { campaignId = null } = options

    const result = {
        before: null,
        after: null,
    }

    // Capture "before" screenshot
    result.before = await captureScreenshot(page, {
        domain,
        type: 'before',
        campaignId,
        fullPage: true,
    })

    return result
}

/**
 * Capture "after" screenshot (call this after form submission)
 */
export async function captureAfterScreenshot(page, domain, options = {}) {
    const { campaignId = null } = options

    return captureScreenshot(page, {
        domain,
        type: 'after',
        campaignId,
        fullPage: true,
    })
}

/**
 * Capture error screenshot
 */
export async function captureErrorScreenshot(page, domain, options = {}) {
    const { campaignId = null, error = null } = options

    return captureScreenshot(page, {
        domain,
        type: 'error',
        campaignId,
        fullPage: false,
    })
}

// ============================================================
// SCREENSHOT MANAGEMENT
// ============================================================

/**
 * List all screenshots
 */
export async function listScreenshots(options = {}) {
    const { campaignId = null, type = null, limit = 50 } = options

    await ensureScreenshotDir()

    const screenshots = []

    async function scanDir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                    await scanDir(fullPath)
                } else if (entry.name.endsWith('.png')) {
                    const stat = await fs.stat(fullPath)
                    screenshots.push({
                        path: fullPath,
                        filename: entry.name,
                        size: stat.size,
                        createdAt: stat.birthtime,
                    })
                }
            }
        } catch (err) {
            // Directory might not exist
        }
    }

    const searchDir = campaignId
        ? path.join(SCREENSHOTS_DIR, 'campaigns', campaignId)
        : SCREENSHOTS_DIR

    await scanDir(searchDir)

    // Filter by type if specified
    let filtered = screenshots
    if (type) {
        filtered = screenshots.filter(s => s.filename.startsWith(type + '_'))
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt)

    // Limit results
    return filtered.slice(0, limit)
}

/**
 * Get screenshot by path
 */
export async function getScreenshot(filepath) {
    try {
        const stat = await fs.stat(filepath)
        const content = await fs.readFile(filepath)

        return {
            path: filepath,
            filename: path.basename(filepath),
            size: stat.size,
            createdAt: stat.birthtime,
            content: content.toString('base64'),
            mimeType: 'image/png',
        }
    } catch (error) {
        return null
    }
}

/**
 * Delete a screenshot
 */
export async function deleteScreenshot(filepath) {
    try {
        await fs.unlink(filepath)
        console.log(`🗑️ Screenshot deleted: ${filepath}`)
        return true
    } catch (error) {
        return false
    }
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Clean up old screenshots
 */
export async function cleanupOldScreenshots(maxAgeDays = MAX_SCREENSHOT_AGE_DAYS) {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const now = Date.now()

    let cleaned = 0
    let freedBytes = 0

    async function cleanDir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                    await cleanDir(fullPath)

                    // Remove empty directories
                    try {
                        const remaining = await fs.readdir(fullPath)
                        if (remaining.length === 0) {
                            await fs.rmdir(fullPath)
                        }
                    } catch (err) { }
                } else if (entry.name.endsWith('.png')) {
                    const stat = await fs.stat(fullPath)
                    const age = now - stat.mtime.getTime()

                    if (age > maxAgeMs) {
                        freedBytes += stat.size
                        await fs.unlink(fullPath)
                        cleaned++
                    }
                }
            }
        } catch (err) {
            // Directory might not exist
        }
    }

    await cleanDir(SCREENSHOTS_DIR)

    console.log(`🧹 Cleaned up ${cleaned} old screenshots (freed ${Math.round(freedBytes / 1024 / 1024)}MB)`)

    return {
        cleaned,
        freedBytes,
    }
}

/**
 * Get storage stats
 */
export async function getStorageStats() {
    let totalSize = 0
    let totalCount = 0

    async function scanDir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                    await scanDir(fullPath)
                } else if (entry.name.endsWith('.png')) {
                    const stat = await fs.stat(fullPath)
                    totalSize += stat.size
                    totalCount++
                }
            }
        } catch (err) { }
    }

    await scanDir(SCREENSHOTS_DIR)

    return {
        totalCount,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
    }
}

// ============================================================
// SUBMISSION RECORD INTEGRATION
// ============================================================

/**
 * Create a screenshot record for database storage
 */
export function createScreenshotRecord(screenshotResult, submissionId = null) {
    if (!screenshotResult?.success) return null

    return {
        submissionId,
        path: screenshotResult.path,
        type: screenshotResult.type,
        timestamp: screenshotResult.timestamp,
        domain: screenshotResult.domain,
    }
}

/**
 * Get screenshots for a submission
 */
export async function getSubmissionScreenshots(domain, timestamp) {
    const screenshots = await listScreenshots({ limit: 100 })

    return screenshots.filter(s =>
        s.filename.includes(domain.replace(/[^a-zA-Z0-9.-]/g, '_')) &&
        Math.abs(s.createdAt.getTime() - timestamp) < 60000 // Within 1 minute
    )
}
