/**
 * DETAILED DEBUG: Comment Submission Test
 * This test will capture screenshots and log everything to debug why comments aren't appearing
 */

import { chromium } from 'playwright'

const TEST_URL = 'https://bundlewp.com/hello-world/'  // A post with comments enabled
const TEST_DATA = {
    name: 'Debug Test User',
    email: 'debugtest@example.com',
    comment: 'THIS IS A DEBUG TEST COMMENT - ' + new Date().toISOString()
}

async function debugCommentSubmission() {
    console.log('='.repeat(60))
    console.log('🔍 DETAILED COMMENT SUBMISSION DEBUG')
    console.log('='.repeat(60))
    console.log('\nTest URL:', TEST_URL)
    console.log('Test Data:', TEST_DATA)

    let browser = null

    try {
        // Launch browser with visible window for debugging
        console.log('\n1. Launching browser...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 }
        })
        const page = await context.newPage()

        // Navigate
        console.log('2. Navigating to page...')
        await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 })
        console.log('   Page loaded:', page.url())

        // Screenshot BEFORE
        await page.screenshot({ path: 'debug_1_before.png', fullPage: true })
        console.log('   📸 Screenshot saved: debug_1_before.png')

        // Check if comment form exists
        console.log('\n3. Looking for comment form...')
        const commentFormSelectors = [
            '#commentform',
            '.comment-form',
            'form#commentform',
            'form.comment-respond',
            '#respond form'
        ]

        let formFound = null
        for (const selector of commentFormSelectors) {
            const el = await page.$(selector)
            if (el) {
                formFound = selector
                console.log('   ✓ Found comment form:', selector)
                break
            }
        }

        if (!formFound) {
            console.log('   ❌ No comment form found on page!')
            const pageContent = await page.content()
            if (pageContent.includes('Comments are closed')) {
                console.log('   ⚠️ Comments are CLOSED on this post!')
            }
            return
        }

        // Find and fill comment field
        console.log('\n4. Filling comment field...')
        const commentSelectors = ['#comment', 'textarea[name="comment"]', '.comment-form-comment textarea']
        let commentFilled = false
        for (const selector of commentSelectors) {
            const el = await page.$(selector)
            if (el) {
                await el.fill(TEST_DATA.comment)
                console.log('   ✓ Filled comment with selector:', selector)
                commentFilled = true
                break
            }
        }
        if (!commentFilled) console.log('   ❌ Could not find comment textarea!')

        // Fill name
        console.log('5. Filling name field...')
        const nameSelectors = ['#author', 'input[name="author"]', '.comment-form-author input']
        let nameFilled = false
        for (const selector of nameSelectors) {
            const el = await page.$(selector)
            if (el) {
                await el.fill(TEST_DATA.name)
                console.log('   ✓ Filled name with selector:', selector)
                nameFilled = true
                break
            }
        }
        if (!nameFilled) console.log('   ⚠️ Name field not found (may be optional)')

        // Fill email
        console.log('6. Filling email field...')
        const emailSelectors = ['#email', 'input[name="email"]', '.comment-form-email input']
        let emailFilled = false
        for (const selector of emailSelectors) {
            const el = await page.$(selector)
            if (el) {
                await el.fill(TEST_DATA.email)
                console.log('   ✓ Filled email with selector:', selector)
                emailFilled = true
                break
            }
        }
        if (!emailFilled) console.log('   ⚠️ Email field not found (may be optional)')

        // Screenshot AFTER FILLING (before submit)
        await page.screenshot({ path: 'debug_2_filled.png', fullPage: true })
        console.log('   📸 Screenshot saved: debug_2_filled.png')

        // Look for submit button
        console.log('\n7. Looking for submit button...')
        const submitSelectors = [
            '#submit',
            'input[type="submit"]',
            'button[type="submit"]',
            '.submit',
            '#comment-submit',
            'input[name="submit"]'
        ]

        let submitButton = null
        let submitSelector = null
        for (const selector of submitSelectors) {
            const el = await page.$(selector)
            if (el && await el.isVisible()) {
                submitButton = el
                submitSelector = selector
                console.log('   ✓ Found submit button:', selector)
                break
            }
        }

        if (!submitButton) {
            console.log('   ❌ No submit button found!')
            return
        }

        // Click submit and wait
        console.log('\n8. CLICKING SUBMIT BUTTON...')

        // Listen for navigation or AJAX
        const [response] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('wp-comments-post') || resp.url().includes('admin-ajax'), { timeout: 30000 }).catch(() => null),
            submitButton.click()
        ])

        if (response) {
            console.log('   ✓ Detected form submission response!')
            console.log('   Response URL:', response.url())
            console.log('   Response Status:', response.status())

            try {
                const responseText = await response.text()
                console.log('   Response body (first 500 chars):', responseText.substring(0, 500))
            } catch (e) { }
        } else {
            console.log('   ⚠️ No wp-comments-post response detected')
        }

        // Wait for any page changes
        console.log('9. Waiting for page to settle...')
        await page.waitForTimeout(3000)

        // Screenshot AFTER submit
        await page.screenshot({ path: 'debug_3_after.png', fullPage: true })
        console.log('   📸 Screenshot saved: debug_3_after.png')

        // Check what happened
        console.log('\n10. Analyzing result...')
        const pageText = await page.textContent('body')
        const pageTextLower = pageText.toLowerCase()

        if (pageTextLower.includes('awaiting moderation') || pageTextLower.includes('your comment is awaiting')) {
            console.log('   ✅ SUCCESS: Comment is awaiting moderation!')
        } else if (pageTextLower.includes('duplicate comment')) {
            console.log('   ⚠️ DUPLICATE: This comment already exists')
        } else if (pageTextLower.includes('error') || pageTextLower.includes('failed')) {
            console.log('   ❌ ERROR: Form submission failed')
        } else if (pageTextLower.includes(TEST_DATA.comment.substring(0, 20).toLowerCase())) {
            console.log('   ✅ SUCCESS: Comment appears on page!')
        } else {
            console.log('   ❓ UNKNOWN: Could not determine result')
            console.log('   Check the debug_3_after.png screenshot')
        }

        // Final URL
        console.log('\nFinal URL:', page.url())

    } catch (error) {
        console.error('\n❌ ERROR:', error.message)
        console.error('Stack:', error.stack)
    } finally {
        if (browser) await browser.close()
    }

    console.log('\n' + '='.repeat(60))
    console.log('🏁 DEBUG COMPLETE - Check screenshots: debug_1_before.png, debug_2_filled.png, debug_3_after.png')
    console.log('='.repeat(60))
}

debugCommentSubmission().then(() => process.exit(0)).catch(() => process.exit(1))
