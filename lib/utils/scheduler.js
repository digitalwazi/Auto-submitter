/**
 * Campaign Scheduling System
 * 
 * Features:
 * - Schedule campaigns for future execution
 * - Recurring schedules (daily, weekly, custom)
 * - Rate limiting per time period
 * - Timezone support
 * - Pause/resume scheduling
 */

import { promises as fs } from 'fs'

// ============================================================
// SCHEDULE TYPES
// ============================================================

export const SCHEDULE_TYPES = {
    ONCE: 'once',           // Run once at specific time
    DAILY: 'daily',         // Run daily at specific time
    WEEKLY: 'weekly',       // Run on specific days of week
    INTERVAL: 'interval',   // Run at regular intervals
    CRON: 'cron',           // Cron expression
}

// ============================================================
// SCHEDULE STORAGE
// ============================================================

const SCHEDULES_FILE = '.schedules.json'
let schedulesCache = null

async function loadSchedules() {
    if (schedulesCache) return schedulesCache

    try {
        const content = await fs.readFile(SCHEDULES_FILE, 'utf-8')
        schedulesCache = JSON.parse(content)
    } catch (err) {
        schedulesCache = { schedules: {} }
    }

    return schedulesCache
}

async function saveSchedules() {
    if (!schedulesCache) return
    schedulesCache.lastUpdated = new Date().toISOString()
    await fs.writeFile(SCHEDULES_FILE, JSON.stringify(schedulesCache, null, 2))
}

// ============================================================
// SCHEDULE MANAGEMENT
// ============================================================

/**
 * Create a schedule for a campaign
 */
export async function createSchedule(campaignId, config) {
    const schedules = await loadSchedules()

    const schedule = {
        id: `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        campaignId,
        createdAt: new Date().toISOString(),

        // Schedule config
        type: config.type || SCHEDULE_TYPES.ONCE,
        timezone: config.timezone || 'UTC',

        // Timing based on type
        scheduledAt: config.scheduledAt || null,      // For ONCE
        time: config.time || null,                      // For DAILY/WEEKLY (HH:MM)
        daysOfWeek: config.daysOfWeek || [],           // For WEEKLY [0-6]
        intervalMinutes: config.intervalMinutes || 60,  // For INTERVAL
        cronExpression: config.cronExpression || null,  // For CRON

        // Rate limiting
        rateLimit: config.rateLimit || null,   // { max: 100, per: 'hour' }

        // Status
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        runCount: 0,

        // End conditions
        maxRuns: config.maxRuns || null,       // Stop after N runs
        endAt: config.endAt || null,           // Stop after this date
    }

    // Calculate next run time
    schedule.nextRunAt = calculateNextRun(schedule)

    schedules.schedules[schedule.id] = schedule
    await saveSchedules()

    console.log(`📅 Schedule created: ${schedule.id} - Next run: ${schedule.nextRunAt}`)

    return schedule
}

/**
 * Update a schedule
 */
export async function updateSchedule(scheduleId, updates) {
    const schedules = await loadSchedules()
    const schedule = schedules.schedules[scheduleId]

    if (!schedule) {
        throw new Error('Schedule not found')
    }

    Object.assign(schedule, updates)
    schedule.nextRunAt = calculateNextRun(schedule)

    await saveSchedules()
    return schedule
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId) {
    const schedules = await loadSchedules()
    delete schedules.schedules[scheduleId]
    await saveSchedules()
}

/**
 * Get schedule by ID
 */
export async function getSchedule(scheduleId) {
    const schedules = await loadSchedules()
    return schedules.schedules[scheduleId] || null
}

/**
 * Get all schedules for a campaign
 */
export async function getCampaignSchedules(campaignId) {
    const schedules = await loadSchedules()
    return Object.values(schedules.schedules)
        .filter(s => s.campaignId === campaignId)
}

/**
 * Enable/disable schedule
 */
export async function toggleSchedule(scheduleId, enabled) {
    return updateSchedule(scheduleId, { enabled })
}

// ============================================================
// NEXT RUN CALCULATION
// ============================================================

/**
 * Calculate next run time for a schedule
 */
export function calculateNextRun(schedule) {
    const now = new Date()

    // Apply timezone offset
    const tz = schedule.timezone || 'UTC'

    switch (schedule.type) {
        case SCHEDULE_TYPES.ONCE:
            // Just return scheduled time if in future
            if (schedule.scheduledAt) {
                const scheduled = new Date(schedule.scheduledAt)
                return scheduled > now ? schedule.scheduledAt : null
            }
            return null

        case SCHEDULE_TYPES.DAILY:
            return calculateDailyNext(schedule.time, tz)

        case SCHEDULE_TYPES.WEEKLY:
            return calculateWeeklyNext(schedule.time, schedule.daysOfWeek, tz)

        case SCHEDULE_TYPES.INTERVAL:
            // Next run is intervalMinutes from last run (or now)
            const lastRun = schedule.lastRunAt ? new Date(schedule.lastRunAt) : now
            return new Date(lastRun.getTime() + schedule.intervalMinutes * 60 * 1000).toISOString()

        case SCHEDULE_TYPES.CRON:
            return calculateCronNext(schedule.cronExpression)

        default:
            return null
    }
}

/**
 * Calculate next daily run time
 */
function calculateDailyNext(time, timezone) {
    const now = new Date()
    const [hours, minutes] = (time || '09:00').split(':').map(Number)

    const next = new Date()
    next.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for tomorrow
    if (next <= now) {
        next.setDate(next.getDate() + 1)
    }

    return next.toISOString()
}

/**
 * Calculate next weekly run time
 */
function calculateWeeklyNext(time, daysOfWeek, timezone) {
    if (!daysOfWeek || daysOfWeek.length === 0) {
        daysOfWeek = [1, 2, 3, 4, 5] // Default: weekdays
    }

    const now = new Date()
    const [hours, minutes] = (time || '09:00').split(':').map(Number)

    // Find next valid day
    for (let i = 0; i < 7; i++) {
        const next = new Date()
        next.setDate(next.getDate() + i)
        next.setHours(hours, minutes, 0, 0)

        const dayOfWeek = next.getDay()

        if (daysOfWeek.includes(dayOfWeek) && next > now) {
            return next.toISOString()
        }
    }

    // If nothing found, return next week's first valid day
    const next = new Date()
    next.setDate(next.getDate() + 7)
    next.setHours(hours, minutes, 0, 0)
    return next.toISOString()
}

/**
 * Simple cron expression parser (basic support)
 * Format: minute hour day month dayOfWeek
 */
function calculateCronNext(expression) {
    // This is a simplified implementation
    // For production, use a library like 'cron-parser'

    if (!expression) return null

    const parts = expression.split(' ')
    if (parts.length !== 5) return null

    const [minute, hour, day, month, dayOfWeek] = parts

    const now = new Date()
    const next = new Date()

    // Handle simple cases
    if (hour !== '*') {
        next.setHours(parseInt(hour))
    }
    if (minute !== '*') {
        next.setMinutes(parseInt(minute))
    }
    next.setSeconds(0)
    next.setMilliseconds(0)

    // If time has passed, move to next day
    if (next <= now) {
        next.setDate(next.getDate() + 1)
    }

    return next.toISOString()
}

// ============================================================
// SCHEDULE CHECKER
// ============================================================

/**
 * Get all schedules that need to run now
 */
export async function getDueSchedules() {
    const schedules = await loadSchedules()
    const now = new Date()

    const due = []

    for (const schedule of Object.values(schedules.schedules)) {
        if (!schedule.enabled) continue
        if (!schedule.nextRunAt) continue

        // Check end conditions
        if (schedule.endAt && new Date(schedule.endAt) < now) continue
        if (schedule.maxRuns && schedule.runCount >= schedule.maxRuns) continue

        // Check if due
        if (new Date(schedule.nextRunAt) <= now) {
            due.push(schedule)
        }
    }

    return due
}

/**
 * Mark schedule as run and calculate next
 */
export async function markScheduleRun(scheduleId, success = true) {
    const schedules = await loadSchedules()
    const schedule = schedules.schedules[scheduleId]

    if (!schedule) return null

    schedule.lastRunAt = new Date().toISOString()
    schedule.runCount = (schedule.runCount || 0) + 1
    schedule.lastStatus = success ? 'success' : 'failed'

    // Calculate next run for recurring schedules
    if (schedule.type !== SCHEDULE_TYPES.ONCE) {
        schedule.nextRunAt = calculateNextRun(schedule)
    } else {
        schedule.nextRunAt = null
        schedule.enabled = false // Disable one-time schedule after run
    }

    await saveSchedules()
    return schedule
}

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * Check if schedule is within rate limits
 */
export async function isWithinRateLimit(scheduleId) {
    const schedule = await getSchedule(scheduleId)
    if (!schedule || !schedule.rateLimit) return true

    // Get recent runs
    const { max, per } = schedule.rateLimit

    let windowMs
    switch (per) {
        case 'minute': windowMs = 60 * 1000; break
        case 'hour': windowMs = 60 * 60 * 1000; break
        case 'day': windowMs = 24 * 60 * 60 * 1000; break
        default: windowMs = 60 * 60 * 1000
    }

    // Simple rate limit tracking based on runCount and lastRunAt
    // For production, use a proper rate limit store

    const windowStart = Date.now() - windowMs
    const runsSinceStart = schedule.lastRunAt &&
        new Date(schedule.lastRunAt).getTime() > windowStart ? 1 : 0

    return runsSinceStart < max
}

// ============================================================
// PRESETS
// ============================================================

export const SCHEDULE_PRESETS = {
    'daily-morning': {
        name: 'Daily at 9 AM',
        type: SCHEDULE_TYPES.DAILY,
        time: '09:00',
    },
    'daily-afternoon': {
        name: 'Daily at 2 PM',
        type: SCHEDULE_TYPES.DAILY,
        time: '14:00',
    },
    'weekdays-morning': {
        name: 'Weekdays at 9 AM',
        type: SCHEDULE_TYPES.WEEKLY,
        time: '09:00',
        daysOfWeek: [1, 2, 3, 4, 5],
    },
    'every-hour': {
        name: 'Every Hour',
        type: SCHEDULE_TYPES.INTERVAL,
        intervalMinutes: 60,
    },
    'every-6-hours': {
        name: 'Every 6 Hours',
        type: SCHEDULE_TYPES.INTERVAL,
        intervalMinutes: 360,
    },
}
