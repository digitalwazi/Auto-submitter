/**
 * Retry Utility
 * 
 * Provides retry logic for submission functions with configurable
 * retry count and delay. Handles transient errors gracefully.
 */

const MAX_RETRIES = 1 // Retry once on failure
const RETRY_DELAY = 2000 // 2 seconds between retries

/**
 * Retry wrapper - attempts an async function with retries
 */
export async function withRetry(fn, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) {
    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn()
            return result
        } catch (error) {
            lastError = error

            if (attempt < maxRetries) {
                console.log(`   ⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }

    throw lastError
}

/**
 * Check if an error message indicates we should retry
 */
export function shouldRetry(message) {
    if (!message) return false
    const msg = message.toLowerCase()

    const retryableErrors = [
        'timeout',
        'network',
        'connection',
        'econnreset',
        'econnrefused',
        'socket',
        'navigation failed',
        'page crashed',
        'target closed',
        'context destroyed',
        'browser has been closed',
        'no response received',
        'net::err',
        'err_network',
        'err_connection',
        'err_timed_out',
    ]

    return retryableErrors.some(err => msg.includes(err))
}

/**
 * Submit form with automatic retry on transient errors
 */
export async function submitFormWithRetry(submitFormFn, url, formFields, data, options) {
    return withRetry(async () => {
        const result = await submitFormFn(url, formFields, data, options)

        // If result indicates a transient error, throw to trigger retry
        if (!result.success && shouldRetry(result.message)) {
            throw new Error(result.message)
        }

        return result
    })
}

/**
 * Submit comment with automatic retry on transient errors
 */
export async function submitCommentWithRetry(submitCommentFn, url, commentFields, data) {
    return withRetry(async () => {
        const result = await submitCommentFn(url, commentFields, data)

        // If result indicates a transient error, throw to trigger retry
        if (!result.success && shouldRetry(result.message)) {
            throw new Error(result.message)
        }

        return result
    })
}
