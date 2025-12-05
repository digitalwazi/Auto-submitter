// Wait for form to be visible
const formSelector = formData.selector || 'form'
await page.waitForSelector(formSelector, { timeout: 5000 })

// Fill form fields
const fillResults = await fillFormFields(page, formData.fields, submissionData)

// Check for CAPTCHA
const hasCaptcha = await detectCaptcha(page)
if (hasCaptcha) {
    const screenshotPath = await captureScreenshot(page, 'captcha')
    return {
        success: false,
        status: 'CAPTCHA_DETECTED',
        message: 'CAPTCHA detected, manual intervention required',
        screenshot: screenshotPath,
        fillResults,
    }
}

// Find and click submit button
const submitButton = await findSubmitButton(page, formSelector)
if (!submitButton) {
    throw new Error('Submit button not found')
}

// Take screenshot before submission
const beforeScreenshot = await captureScreenshot(page, 'before-submit')

// Submit form
await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { }),
    submitButton.click(),
])

// Wait a bit for response
await page.waitForTimeout(2000)

// Take screenshot after submission
const afterScreenshot = await captureScreenshot(page, 'after-submit')

// Check for success indicators
const success = await checkSubmissionSuccess(page)

return {
    success: success.isSuccess,
    status: success.isSuccess ? 'SUCCESS' : 'FAILED',
    message: success.message,
    screenshot: afterScreenshot,
    fillResults,
}
}

async function fillFormFields(page, fields, submissionData) {
    const results = []

    for (const field of fields) {
        try {
            const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`

            // Determine what value to use
            let value = getFieldValue(field, submissionData)

            if (!value) continue

            // Wait for field
            await page.waitForSelector(selector, { timeout: 3000 })

            // Fill based on field type
            if (field.type === 'checkbox') {
                await page.check(selector)
            } else if (field.type === 'radio') {
                await page.check(selector)
            } else if (field.type === 'select') {
                await page.selectOption(selector, value)
            } else {
                // Clear and type
                await page.fill(selector, '')
                await page.type(selector, value, { delay: 50 })
            }

            results.push({ field: field.name || field.id, success: true })

        } catch (error) {
            console.error(`Failed to fill field ${field.name}:`, error.message)
            results.push({ field: field.name || field.id, success: false, error: error.message })
        }
    }

    return results
}

function getFieldValue(field, submissionData) {
    const fieldName = (field.name || '').toLowerCase()
    const fieldLabel = (field.label || '').toLowerCase()
    const fieldPlaceholder = (field.placeholder || '').toLowerCase()

    const allText = `${fieldName} ${fieldLabel} ${fieldPlaceholder}`

    // Email field
    if (field.type === 'email' || allText.includes('email') || allText.includes('e-mail')) {
        return submissionData.email
    }

    // Name field
    if (allText.includes('name') && !allText.includes('user') && !allText.includes('company')) {
        return submissionData.name
    }

    // Subject field
    if (allText.includes('subject')) {
        return submissionData.subject || 'Inquiry'
    }

    // Phone field
    if (allText.includes('phone') || allText.includes('tel')) {
        return submissionData.phone || ''
    }

    // Message/Comment field
    if (field.tagName === 'textarea' || allText.includes('message') || allText.includes('comment')) {
        return submissionData.message
    }

    // Website field
    if (allText.includes('website') || allText.includes('url')) {
        return submissionData.website || ''
    }

    return null
}

async function findSubmitButton(page, formSelector) {
    // Try different submit button selectors
    const selectors = [
        `${formSelector} button[type="submit"]`,
        `${formSelector} input[type="submit"]`,
        `${formSelector} button:has-text("Submit")`,
        `${formSelector} button:has-text("Send")`,
        `${formSelector} button:has-text("Contact")`,
        `${formSelector} button`,
    ]

    for (const selector of selectors) {
        const button = await page.locator(selector).first()
        if (await button.count() > 0) {
            return button
        }
    }

    return null
}

async function detectCaptcha(page) {
    const captchaSelectors = [
        '.g-recaptcha',
        '#recaptcha',
        '[data-sitekey]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.h-captcha',
    ]

    for (const selector of captchaSelectors) {
        const element = await page.locator(selector).count()
        if (element > 0) return true
    }

    return false
}

async function checkSubmissionSuccess(page) {
    const pageContent = await page.content()
    const lowerContent = pageContent.toLowerCase()

    // Success indicators
    const successKeywords = [
        'thank you',
        'thanks for',
        'message sent',
        'successfully submitted',
        'we will contact',
        'we\'ll get back',
        'received your message',
    ]

    for (const keyword of successKeywords) {
        if (lowerContent.includes(keyword)) {
            return { isSuccess: true, message: `Found success indicator: "${keyword}"` }
        }
    }

    // Error indicators
    const errorKeywords = ['error', 'failed', 'invalid', 'required field']
    for (const keyword of errorKeywords) {
        if (lowerContent.includes(keyword)) {
            return { isSuccess: false, message: `Found error indicator: "${keyword}"` }
        }
    }

    return { isSuccess: true, message: 'Form submitted, no clear success/error indicator' }
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
