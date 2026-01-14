/**
 * Campaign Logger - Logs to both console and database for live UI view
 */

import prisma from './db.js'

export async function logCampaign(campaignId, message, level = 'INFO', domainId = null) {
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
    try {
        await prisma.campaignLog.create({
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

// Shorthand helpers
export const logInfo = (campaignId, message, domainId) => logCampaign(campaignId, message, 'INFO', domainId)
export const logSuccess = (campaignId, message, domainId) => logCampaign(campaignId, message, 'SUCCESS', domainId)
export const logWarning = (campaignId, message, domainId) => logCampaign(campaignId, message, 'WARNING', domainId)
export const logError = (campaignId, message, domainId) => logCampaign(campaignId, message, 'ERROR', domainId)
export const logStep = (campaignId, message, domainId) => logCampaign(campaignId, message, 'STEP', domainId)
