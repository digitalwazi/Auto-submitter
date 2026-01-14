import { getBrowserContext, releaseBrowserContext, safeNavigate, getContextFingerprint } from './browser-pool.js'
import { processTemplate, PRESET_TEMPLATES } from '../utils/message-templates.js'
import { humanFill, humanClick, humanDelay, scrollToElement, thinkingPause, applyBehaviorProfile, BEHAVIOR_PROFILES } from './human-behavior.js'
import { captureScreenshot, captureAfterScreenshot } from '../utils/screenshot-manager.js'
import { calculateFormScore, recordResult } from '../utils/form-prioritizer.js'
import { isDuplicate, recordSubmission } from '../utils/duplicate-detector.js'

/**
 * Universal Form Submitter with All Features
 * 
 * Integrated Features:
 * - Dynamic message templates with SpinTax
 * - Human-like behavior (delays, mouse movement, typing)
 * - Browser fingerprint randomization
 * - Screenshots before/after submission
 * - Smart form prioritization
 * - Duplicate detection
 * - Retry logic
 */

export async function submitForm(url, formFields, submissionData, options = {}) {
    let context = null
    let page = null
    const startTime = Date.now()
    const screenshots = { before: null, after: null }

    try {
        // 1. Check for duplicates
        if (options.skipDuplicates !== false) {
            const dupCheck = await isDuplicate(url, formFields?.action)
            if (dupCheck.isDuplicate && options.allowResubmit !== true) {
                console.log(`⏭️ Skipping duplicate: ${url}`)
                return {
                    success: false,
                    status: 'SKIPPED_DUPLICATE',
                    message: 'Already submitted previously',
                    duplicate: dupCheck,
                }
            }
        }

        // 2. Check form priority
        if (formFields && options.minScore) {
            const priority = calculateFormScore(formFields)
            if (priority.score < options.minScore) {
                console.log(`⏭️ Skipping low-priority form (score: ${priority.score}): ${url}`)
                return {
                    success: false,
                    status: 'SKIPPED_LOW_PRIORITY',
                    message: `Form score ${priority.score} below minimum ${options.minScore}`,
                    priority,
                }
            }
        }

        console.log(`📝 Submitting form: ${url}`)
        console.log(`   Plugin type: ${formFields?.pluginType || 'standard'}`)

        // 3. Get browser with fingerprint
        context = await getBrowserContext({ newFingerprint: options.freshFingerprint })
        const fingerprint = getContextFingerprint(context)
        page = await context.newPage()

        // 4. Navigate with safety checks
        const navResult = await safeNavigate(page, url, { timeout: 60000 })
        if (!navResult.success) {
            throw new Error(`Navigation failed: ${navResult.error}`)
        }

        // 5. Wait for page to settle + human-like pause
        await humanDelay(1000, 2000)
        await waitForFormsToLoad(page, formFields?.pluginType)

        // 6. Capture before screenshot if enabled
        if (options.screenshots !== false) {
            screenshots.before = await captureScreenshot(page, {
                domain: extractDomain(url),
                type: 'before',
                campaignId: options.campaignId,
            })
        }

        // 7. Process message template
        const processedData = processSubmissionData(submissionData, {
            domain: extractDomain(url),
        })

        // 8. Fill form fields with human-like behavior
        const behaviorProfile = applyBehaviorProfile(options.behaviorProfile || 'normal')
        const filledFields = await fillFormFieldsWithBehavior(page, formFields, processedData, behaviorProfile)
        console.log(`   Filled ${filledFields} fields`)

        if (filledFields === 0) {
            throw new Error('No fields could be filled')
        }

        // 9. Pre-submit thinking pause
        await thinkingPause()

        // 10. Submit the form with human-like click
        const submitResult = await submitFormButton(page, formFields?.pluginType)

        if (!submitResult.clicked) {
            throw new Error('Submit button not found or not clickable')
        }

        // 11. Wait for response
        await waitForSubmission(page, formFields?.pluginType)

        // 12. Capture after screenshot
        if (options.screenshots !== false) {
            screenshots.after = await captureAfterScreenshot(page, extractDomain(url), {
                campaignId: options.campaignId,
            })
        }

        // 13. Verify submission
        const verification = await verifySubmission(page)

        // 14. Record submission for duplicate detection
        await recordSubmission(url, formFields?.action, {
            formType: formFields?.pluginType,
            campaignId: options.campaignId,
            status: verification.success ? 'success' : 'uncertain',
        })

        // 15. Record for learning
        if (formFields?.pluginType) {
            recordResult(formFields.pluginType, formFields.formType, verification.success)
        }

        const duration = Date.now() - startTime

        console.log(`   ${verification.success ? '✅' : '⚠️'} Result: ${verification.status} (${duration}ms)`)

        return {
            success: verification.success,
            status: verification.status,
            message: verification.message,
            filledFields,
            duration,
            screenshots,
            fingerprint: fingerprint ? {
                viewport: fingerprint.viewport,
                locale: fingerprint.locale,
                timezone: fingerprint.timezoneId,
            } : null,
        }

    } catch (error) {
        console.error(`   ❌ Form submission error: ${error.message}`)

        // Capture error screenshot
        if (page && options.screenshots !== false) {
            screenshots.error = await captureScreenshot(page, {
                domain: extractDomain(url),
                type: 'error',
                campaignId: options.campaignId,
            }).catch(() => null)
        }

        // Record failed submission
        await recordSubmission(url, formFields?.action, {
            formType: formFields?.pluginType,
            campaignId: options.campaignId,
            status: 'failed',
            error: error.message,
        }).catch(() => { })

        return {
            success: false,
            status: 'FAILED',
            message: error.message,
            duration: Date.now() - startTime,
            screenshots,
        }
    } finally {
        if (page) await page.close().catch(() => { })
        if (context) await releaseBrowserContext(context).catch(() => { })
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function extractDomain(url) {
    try {
        return new URL(url).hostname
    } catch {
        return url
    }
}

function processSubmissionData(data, context = {}) {
    // Defensive: if data is undefined/null, use empty object
    if (!data) {
        console.warn('⚠️ processSubmissionData called with undefined data, using defaults')
        data = {}
    }

    // If message is a template, process it
    const processedMessage = processTemplate(data.message || '', {
        name: data.name || data.senderName || 'Anonymous',
        email: data.email || data.senderEmail || 'contact@example.com',
        domain: context.domain,
        company: data.company,
        website: data.website,
    })

    return {
        ...data,
        message: processedMessage,
    }
}

// ============================================================
// FORM FILLING WITH HUMAN BEHAVIOR
// ============================================================

async function fillFormFieldsWithBehavior(page, formFields, data, behavior = {}) {
    let filledCount = 0

    const fieldPatterns = {
        name: ['name', 'full_name', 'fullname', 'your-name', 'your_name', 'author', 'first_name', 'firstname'],
        email: ['email', 'e-mail', 'your-email', 'your_email', 'mail', 'author_email'],
        subject: ['subject', 'topic', 'title', 'your-subject'],
        message: ['message', 'comment', 'body', 'content', 'text', 'inquiry', 'your-message', 'comments', 'description'],
        phone: ['phone', 'tel', 'telephone', 'mobile', 'your-phone'],
        website: ['website', 'url', 'site', 'web', 'homepage'],
        company: ['company', 'organization', 'business', 'org'],
    }

    // Fill from detected fields
    if (formFields?.fields) {
        for (const field of formFields.fields) {
            const value = getFieldValue(field, data, fieldPatterns)
            if (!value) continue

            const selectors = []
            if (field.id) selectors.push(`#${field.id}`)
            if (field.name) selectors.push(`[name="${field.name}"]`)

            for (const selector of selectors) {
                try {
                    // Scroll to field first
                    await scrollToElement(page, selector)

                    // Human-like fill
                    const filled = await humanFill(page, selector, value, {
                        speed: behavior.typingSpeed,
                    })

                    if (filled) {
                        console.log(`   ✓ Filled: ${field.name || field.id}`)
                        filledCount++
                        break
                    }
                } catch (err) {
                    continue
                }
            }

            // Small delay between fields
            await humanDelay(200, 500)
        }
    }

    // Also try common selectors directly
    const commonSelectors = [
        { selectors: ['[name*="name"]:not([type="hidden"])', '#name', 'input[placeholder*="name" i]'], value: data.name },
        { selectors: ['[name*="email"]', '[type="email"]', '#email'], value: data.email },
        { selectors: ['[name*="subject"]', '#subject'], value: data.subject || 'Contact Inquiry' },
        { selectors: ['textarea[name*="message"]', 'textarea[name*="comment"]', 'textarea:not([name*="search"])'], value: data.message },
        { selectors: ['[name*="phone"]', '[type="tel"]', '#phone'], value: data.phone || '' },
    ]

    for (const { selectors, value } of commonSelectors) {
        if (!value) continue

        for (const selector of selectors) {
            try {
                const element = await page.$(selector)
                if (element) {
                    const currentValue = await element.inputValue().catch(() => '')
                    if (!currentValue) {
                        await scrollToElement(page, selector)
                        await humanFill(page, selector, value)
                        filledCount++
                        await humanDelay(200, 400)
                        break
                    }
                }
            } catch (err) {
                continue
            }
        }
    }

    return filledCount
}

function getFieldValue(field, data, patterns) {
    const name = (field.name || '').toLowerCase()
    const id = (field.id || '').toLowerCase()
    const label = (field.label || '').toLowerCase()
    const placeholder = (field.placeholder || '').toLowerCase()
    const allText = `${name} ${id} ${label} ${placeholder}`

    if (field.type === 'email' || patterns.email.some(p => allText.includes(p))) return data.email
    if (patterns.name.some(p => allText.includes(p)) && !allText.includes('user')) return data.name
    if (patterns.subject.some(p => allText.includes(p))) return data.subject || 'Contact Inquiry'
    if (patterns.message.some(p => allText.includes(p)) || field.tagName === 'textarea') return data.message
    if (patterns.phone.some(p => allText.includes(p)) || field.type === 'tel') return data.phone || ''
    if (patterns.website.some(p => allText.includes(p)) || field.type === 'url') return data.website || ''
    if (patterns.company.some(p => allText.includes(p))) return data.company || data.name

    return null
}

// ============================================================
// FORM SUBMISSION
// ============================================================

async function submitFormButton(page, pluginType) {
    const submitSelectors = getSubmitSelectors(pluginType)

    for (const selector of submitSelectors) {
        try {
            const button = await page.$(selector)
            if (button && await button.isVisible()) {
                await scrollToElement(page, selector)
                await humanDelay(100, 300)
                const clicked = await humanClick(page, selector)
                if (clicked) {
                    return { clicked: true, selector }
                }
            }
        } catch (err) {
            continue
        }
    }

    // Fallback: press Enter
    try {
        await page.keyboard.press('Enter')
        return { clicked: true, selector: 'keyboard:Enter' }
    } catch (err) {
        return { clicked: false }
    }
}

function getSubmitSelectors(pluginType) {
    const pluginSelectors = {
        'contact-form-7': ['.wpcf7-submit', 'input.wpcf7-form-control.wpcf7-submit'],
        'gravity-forms': ['.gform_button', 'input.gform_button'],
        'wpforms': ['.wpforms-submit', 'button.wpforms-submit'],
        'ninja-forms': ['.nf-form-content input[type="button"]'],
        'elementor': ['.elementor-button', 'button.elementor-button'],
        'divi': ['.et_pb_button', '.et_pb_contact_submit'],
        'hubspot': ['.hs-button', 'input.hs-button.primary'],
        'mailchimp': ['#mc-embedded-subscribe', 'input.button'],
    }

    const baseSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        'button:has-text("Send Message")',
        '.submit-btn',
        '.btn-submit',
        'form button',
    ]

    const specific = pluginSelectors[pluginType] || []
    return [...specific, ...baseSelectors]
}

// ============================================================
// WAIT AND VERIFICATION
// ============================================================

async function waitForFormsToLoad(page, pluginType) {
    const waitSelectors = {
        'gravity-forms': '.gform_wrapper',
        'contact-form-7': '.wpcf7-form',
        'wpforms': '.wpforms-form',
        'ninja-forms': '.nf-form-container',
        'elementor': '.elementor-form',
        'hubspot': '.hs-form',
    }

    const selector = waitSelectors[pluginType]
    if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 }).catch(() => { })
    }
}

async function waitForSubmission(page, pluginType) {
    const ajaxPlugins = ['gravity-forms', 'ninja-forms', 'contact-form-7', 'wpforms', 'elementor']

    if (ajaxPlugins.includes(pluginType)) {
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { })
        await humanDelay(1500, 2500)
    } else {
        try {
            await Promise.race([
                page.waitForNavigation({ timeout: 30000 }),
                page.waitForLoadState('networkidle', { timeout: 30000 }),
            ])
        } catch (err) { }
        await humanDelay(1500, 2500)
    }
}

async function verifySubmission(page) {
    const pageText = (await page.textContent('body').catch(() => '')).toLowerCase()
    const currentUrl = page.url()

    const successKeywords = [
        'thank you', 'thanks', 'success', 'submitted', 'received',
        'confirmation', 'sent', 'message sent', 'successfully',
        'we will contact you', 'we\'ll get back', 'appreciate',
        'request received', 'subscribed',
    ]

    const errorKeywords = [
        'error', 'failed', 'invalid', 'required field', 'please fill',
        'cannot be empty', 'incorrect', 'problem', 'oops',
        'something went wrong', 'try again',
    ]

    const hasSuccess = successKeywords.some(kw => pageText.includes(kw))
    // Use same text source for consistency
    const errorMatch = errorKeywords.find(kw => pageText.includes(kw))
    const hasError = !!errorMatch

    if (hasSuccess && !hasError) {
        return { success: true, status: 'SUCCESS', message: 'Form submitted successfully' }
    } else if (hasError) {
        return { success: false, status: 'ERROR', message: `Form reported error (found keyword: "${errorMatch}")` }
    } else if (hasSuccess) {
        // Has success keyword but also has error keyword - consider it partial success
        return { success: true, status: 'SUBMITTED', message: 'Form submitted (verification unclear)' }
    } else {
        return { success: true, status: 'SUBMITTED', message: 'Form submitted - unable to verify success' }
    }
}

// ============================================================
// EXPORTS
// ============================================================

export { PRESET_TEMPLATES, BEHAVIOR_PROFILES }
