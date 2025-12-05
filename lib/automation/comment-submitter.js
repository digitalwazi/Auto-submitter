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

        await page.waitForTimeout(3000)

        console.log(`  ✅ Comment submitted`)

        return {
            success: true,
            status: 'SUCCESS',
            message: 'Comment submitted',
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
