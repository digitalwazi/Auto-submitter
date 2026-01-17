/**
 * Campaign Logger - Logs to both console and database for live UI view
 */

import { prisma } from './db.js'

export async function logCampaign(campaignId, message, level = 'INFO', domainId = null, db = null) {
    // Log to console
    const prefix = {
        'INFO': '📋',
        'SUCCESS': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'STEP': '📍',
    }[level] || '📋'

    console.log(`${prefix} [${campaignId.substring(0, 8)}] ${message}`)

    // Save to database (fire and forget)
    // Use provided DB or default to prisma (SQLite)
    const database = db || prisma

    try {
        await database.campaignLog.create({
            data: {
                campaignId,
                domainId,
                level,
                message,
            }
        })
    } catch (e) {
        // Don't fail if logging fails
        console.error('Failed to save log:', e.message)
    }
}

// Shorthand helpers - updated to accept db instance
export const logInfo = (campaignId, message, domainId, db) => logCampaign(campaignId, message, 'INFO', domainId, db)
export const logSuccess = (campaignId, message, domainId, db) => logCampaign(campaignId, message, 'SUCCESS', domainId, db)
export const logWarning = (campaignId, message, domainId, db) => logCampaign(campaignId, message, 'WARNING', domainId, db)
export const logError = (campaignId, message, domainId, db) => logCampaign(campaignId, message, 'ERROR', domainId, db)
export const logStep = (campaignId, message, domainId, db) => logCampaign(campaignId, message, 'STEP', domainId, db)
