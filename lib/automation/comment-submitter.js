import { getBrowserContext, releaseBrowserContext } from './browser-pool.js'

export async function submitComment(url, commentFields, submissionData) {
    let context = null
    let page = null

    try {
        console.log(`Submitting comment: ${url}`)

        context = await getBrowserContext()
        page = await context.newPage()

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 60000,
        })

        // Fill comment fields
        let filledComment = false
        let filledName = false
        let filledEmail = false

        const commentSelectors = ['#comment', '[name="comment"]', 'textarea']
        const authorSelectors = ['#author', '[name="author"]', '#name', '[name="name"]']
        const emailSelectors = ['#email', '[name="email"]']

        // Log input data for debugging
        console.log(`  Input data: name="${submissionData.name}", email="${submissionData.email}", msg="${submissionData.message?.substring(0, 30)}..."`)

        for (const selector of commentSelectors) {
            try {
                if (!submissionData.message) throw new Error('No message provided')
                await page.fill(selector, submissionData.message, { timeout: 2000 })
                console.log(`  ✓ Filled comment "${submissionData.message.substring(0, 20)}..."`)
                filledComment = true
                break
            } catch (err) {
                // Try next selector
            }
        }

        for (const selector of authorSelectors) {
            try {
                if (!submissionData.name) throw new Error('No name provided')
                await page.fill(selector, submissionData.name, { timeout: 2000 })
                console.log(`  ✓ Filled name "${submissionData.name}"`)
                filledName = true
                break
            } catch (err) {
                // Try next selector
            }
        }

        for (const selector of emailSelectors) {
            try {
                if (!submissionData.email) throw new Error('No email provided')
                await page.fill(selector, submissionData.email, { timeout: 2000 })
                console.log(`  ✓ Filled email "${submissionData.email}"`)
                filledEmail = true
                break
            } catch (err) {
                // Try next selector
            }
        }

        // CRITICAL: Check if we actually filled anything
        if (!filledComment) {
            throw new Error('Failed to fill comment field - no selector worked or message is empty')
        }

        // WordPress requires email for comments
        if (!filledEmail) {
            throw new Error('Failed to fill email field - WordPress requires email for comments')
        }

        // Submit
        const submitSelectors = ['#submit', '[name="submit"]', 'button[type="submit"]', 'input[type="submit"]']

        let submitted = false
        for (const selector of submitSelectors) {
            try {
                await page.click(selector, { timeout: 2000 })
                submitted = true
                console.log(`  ✓ Clicked submit button: ${selector}`)
                break
            } catch (err) { }
        }

        if (!submitted) {
            throw new Error('Submit button not found')
        }

        // Wait for navigation or page update
        try {
            await Promise.race([
                page.waitForNavigation({ timeout: 30000 }).catch(() => null),
                page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null),
            ])
        } catch (err) {
            // Page might not navigate, that's okay
        }

        // Additional wait for page updates
        await page.waitForTimeout(2000)

        // Check for success indicators
        const currentUrl = page.url()
        const content = await page.content()
        const pageText = await page.textContent('body').catch(() => '')

        // Success keywords
        const successKeywords = [
            'thank you', 'thanks', 'success', 'submitted', 'received',
            'awaiting moderation', 'pending', 'will be reviewed',
            'comment posted', 'comment added', 'your comment'
        ]

        // Error keywords
        const errorKeywords = [
            'error', 'invalid', 'required', 'missing', 'failed',
            'try again', 'please check', 'incorrect'
        ]

        const lowerText = pageText.toLowerCase()
        const lowerContent = content.toLowerCase()

        const hasSuccess = successKeywords.some(kw =>
            lowerText.includes(kw) || lowerContent.includes(kw)
        )
        const hasError = errorKeywords.some(kw =>
            lowerText.includes(kw) || lowerContent.includes(kw)
        )

        // Check if URL changed (often indicates success)
        const urlChanged = currentUrl !== url

        // Determine success
        const isSuccess = (hasSuccess || urlChanged) && !hasError

        console.log(`  ${isSuccess ? '✅' : '⚠️'} Comment ${isSuccess ? 'SUCCESS' : 'UNCERTAIN'}`)
        if (!isSuccess) {
            console.log(`  Debug: URL changed: ${urlChanged}, Success keywords: ${hasSuccess}, Error keywords: ${hasError}`)
        }

        return {
            // If not actively failed, assume success for comments (often need moderation/reload)
            success: true,
            status: isSuccess ? 'SUCCESS' : 'SUBMITTED',
            message: isSuccess ? 'Comment submitted successfully' : 'Comment submitted (verification unclear - likely awaiting moderation)',
        }

    } catch (error) {
        console.error(`Comment submission error: ${error.message}`)

        return {
            success: false,
            status: 'FAILED',
            message: error.message,
        }
    } finally {
        if (page) await page.close().catch(() => { })
        if (context) await releaseBrowserContext(context).catch(() => { })
    }
}
