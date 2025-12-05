import { getContext, releaseContext } from './browser-pool.js'
import { nanoid } from 'nanoid'

export async function submitComment(pageUrl, commentData, submissionData) {
    const context = await getContext()
    let page = null

    try {
        page = await context.newPage()

        // Navigate to page
        console.log(`Navigating to ${pageUrl} for comment submission`)
        await page.goto(pageUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        })

        // Wait for comment section
        const commentSelector = commentData.selector
        await page.waitForSelector(commentSelector, { timeout: 5000 })

        // Handle different comment types
        let result
        switch (commentData.type) {
            case 'wordpress':
                result = await submitWordPressComment(page, submissionData)
                break
            case 'disqus':
                result = await submitDisqusComment(page, submissionData)
                break
            default:
                result = await submitGenericComment(page, commentData, submissionData)
        }

        return result

    } catch (error) {
        console.error(`Comment submission error:`, error.message)

        let screenshot = null
        if (page) {
            screenshot = await captureScreenshot(page, 'comment-error').catch(() => null)
        }

        return {
            success: false,
            status: 'FAILED',
            message: error.message,
            screenshot,
        }
    } finally {
        if (page) await page.close()
        await releaseContext(context)
    }
}

async function submitWordPressComment(page, submissionData) {
    try {
        // WordPress comment fields
        await page.waitForSelector('#comment, #commentform textarea', { timeout: 5000 })

        // Fill author name
        const authorField = page.locator('#author, input[name="author"]').first()
        if (await authorField.count() > 0) {
            await authorField.fill(submissionData.name)
        }

        // Fill email
        const emailField = page.locator('#email, input[name="email"]').first()
        if (await emailField.count() > 0) {
            await emailField.fill(submissionData.email)
        }

        // Fill website (optional)
        const urlField = page.locator('#url, input[name="url"]').first()
        if (await urlField.count() > 0 && submissionData.website) {
            await urlField.fill(submissionData.website)
        }

        // Fill comment
        const commentField = page.locator('#comment, textarea[name="comment"]').first()
        await commentField.fill(submissionData.message)

        // Take screenshot before submission
        const beforeScreenshot = await captureScreenshot(page, 'wp-comment-before')

        // Find and click submit
        const submitButton = page.locator('#submit, input[type="submit"][name="submit"], button[type="submit"]').first()
        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { }),
            submitButton.click(),
        ])

        await page.waitForTimeout(2000)

        // Take screenshot after
        const afterScreenshot = await captureScreenshot(page, 'wp-comment-after')

        // Check for moderation message
        const content = await page.content()
        const isModeration = content.toLowerCase().includes('moderation') ||
            content.toLowerCase().includes('awaiting approval')

        const isSuccess = content.toLowerCase().includes('comment') &&
            (isModeration || content.toLowerCase().includes('posted'))

        return {
            success: isSuccess,
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            message: isModeration ? 'Comment submitted, awaiting moderation' : 'Comment posted',
            screenshot: afterScreenshot,
        }

    } catch (error) {
        throw new Error(`WordPress comment submission failed: ${error.message}`)
    }
}

async function submitDisqusComment(page, submissionData) {
    // Disqus comments are loaded in iframe, more complex to handle
    // This is a simplified version
    try {
        await page.waitForSelector('#disqus_thread iframe', { timeout: 5000 })

        return {
            success: false,
            status: 'FAILED',
            message: 'Disqus comments require manual authentication - skipping',
            screenshot: await captureScreenshot(page, 'disqus'),
        }

    } catch (error) {
        throw new Error(`Disqus comment detection failed: ${error.message}`)
    }
}

async function submitGenericComment(page, commentData, submissionData) {
    try {
        // Fill fields based on detected structure
        for (const field of commentData.fields) {
            const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`

            try {
                await page.waitForSelector(selector, { timeout: 3000 })

                // Determine value
                let value = null
                const fieldName = (field.name || '').toLowerCase()
                const fieldLabel = (field.label || '').toLowerCase()

                if (fieldName.includes('name') || fieldLabel.includes('name')) {
                    value = submissionData.name
                } else if (fieldName.includes('email') || fieldLabel.includes('email')) {
                    value = submissionData.email
                } else if (field.tagName === 'textarea' || fieldName.includes('comment') || fieldName.includes('message')) {
                    value = submissionData.message
                }

                if (value) {
                    await page.fill(selector, value)
                }

            } catch (fieldError) {
                console.error(`Failed to fill field ${field.name}:`, fieldError.message)
            }
        }

        // Find submit button
        const commentSelector = commentData.selector
        const submitButton = await findCommentSubmitButton(page, commentSelector)

        if (!submitButton) {
            throw new Error('Comment submit button not found')
        }

        // Submit
        const beforeScreenshot = await captureScreenshot(page, 'generic-comment-before')

        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { }),
            submitButton.click(),
        ])

        await page.waitForTimeout(2000)

        const afterScreenshot = await captureScreenshot(page, 'generic-comment-after')

        return {
            success: true,
            status: 'SUCCESS',
            message: 'Generic comment submitted',
            screenshot: afterScreenshot,
        }

    } catch (error) {
        throw new Error(`Generic comment submission failed: ${error.message}`)
    }
}

async function findCommentSubmitButton(page, formSelector) {
    const selectors = [
        `${formSelector} button[type="submit"]`,
        `${formSelector} input[type="submit"]`,
        `${formSelector} button:has-text("Post")`,
        `${formSelector} button:has-text("Submit")`,
        `${formSelector} button:has-text("Comment")`,
        `${formSelector} button`,
    ]

    for (const selector of selectors) {
        const button = page.locator(selector).first()
        if (await button.count() > 0) {
            return button
        }
    }

    return null
}

async function captureScreenshot(page, prefix) {
    try {
        const filename = `${prefix}-${nanoid(10)}.png`
        const path = `/tmp/${filename}`
        await page.screenshot({ path, fullPage: false })
        return path
    } catch (error) {
        console.error('Screenshot failed:', error.message)
        return null
    }
}
