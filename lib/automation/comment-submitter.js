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
            timeout: 30000,
        })

        // Fill comment fields
        const commentSelectors = ['#comment', '[name="comment"]', 'textarea']
        const authorSelectors = ['#author', '[name="author"]', '#name', '[name="name"]']
        const emailSelectors = ['#email', '[name="email"]']

        for (const selector of commentSelectors) {
            try {
                await page.fill(selector, submissionData.message, { timeout: 2000 })
                console.log(`  ✓ Filled comment`)
                break
            } catch (err) { }
        }

        for (const selector of authorSelectors) {
            try {
                await page.fill(selector, submissionData.name, { timeout: 2000 })
                console.log(`  ✓ Filled name`)
                break
            } catch (err) { }
        }

        for (const selector of emailSelectors) {
            try {
                await page.fill(selector, submissionData.email, { timeout: 2000 })
                console.log(`  ✓ Filled email`)
                break
            } catch (err) { }
        }

        // Submit
        const submitSelectors = ['#submit', '[name="submit"]', 'button[type="submit"]', 'input[type="submit"]']

        let submitted = false
        for (const selector of submitSelectors) {
            try {
                await page.click(selector, { timeout: 2000 })
                submitted = true
                break
            } catch (err) { }
        }

        if (!submitted) {
            throw new Error('Submit button not found')
        }

        // Wait for navigation or page update
        try {
            await Promise.race([
                page.waitForNavigation({ timeout: 10000 }).catch(() => null),
                page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null),
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
            success: isSuccess,
            status: isSuccess ? 'SUCCESS' : 'UNCERTAIN',
            message: isSuccess ? 'Comment submitted successfully' : 'Submitted but success unclear',
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
