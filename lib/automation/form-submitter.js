import { getBrowserContext, releaseBrowserContext } from './browser-pool.js'

export async function submitForm(url, formFields, submissionData) {
    let context = null
    let page = null

    try {
        console.log(`Submitting form: ${url}`)

        context = await getBrowserContext()
        page = await context.newPage()

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000,
        })

        // Fill form fields
        if (formFields?.fields) {
            for (const field of formFields.fields) {
                try {
                    const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`
                    const value = getFieldValue(field, submissionData)

                    if (value) {
                        await page.fill(selector, value, { timeout: 3000 })
                        console.log(`  ✓ Filled: ${field.name}`)
                    }
                } catch (err) {
                    console.log(`  ✗ Failed: ${field.name}`)
                }
            }
        }

        // Submit form
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Send")',
        ]

        let submitted = false
        for (const selector of submitSelectors) {
            try {
                await page.click(selector, { timeout: 2000 })
                submitted = true
                break
            } catch (err) {
                continue
            }
        }

        if (!submitted) {
            throw new Error('Submit button not found')
        }

        // Wait for response
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { })
        await page.waitForTimeout(2000)

        // Check for success
        const content = await page.content()
        const successKeywords = ['thank you', 'thanks', 'success', 'submitted', 'received']
        const isSuccess = successKeywords.some(kw => content.toLowerCase().includes(kw))

        console.log(`  ${isSuccess ? '✅' : '⚠️'} Result: ${isSuccess ? 'SUCCESS' : 'SUBMITTED'}`)

        return {
            success: isSuccess,
            status: isSuccess ? 'SUCCESS' : 'SUBMITTED',
            message: isSuccess ? 'Form submitted successfully' : 'Form submitted',
        }

    } catch (error) {
        console.error(`Form submission error: ${error.message}`)

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

function getFieldValue(field, data) {
    const name = (field.name || field.id || '').toLowerCase()
    const label = (field.label || '').toLowerCase()
    const placeholder = (field.placeholder || '').toLowerCase()
    const allText = `${name} ${label} ${placeholder}`

    if (field.type === 'email' || allText.includes('email')) return data.email
    if (allText.includes('name') && !allText.includes('user')) return data.name
    if (allText.includes('subject')) return data.subject || 'Contact Inquiry'
    if (allText.includes('phone') || allText.includes('tel')) return data.phone || ''
    if (allText.includes('message') || allText.includes('comment') || field.tagName === 'textarea') return data.message
    if (allText.includes('website') || allText.includes('url')) return data.website || ''

    return null
}
