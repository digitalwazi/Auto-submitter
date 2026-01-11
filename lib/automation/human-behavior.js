/**
 * Human-like Behavior Module
 * 
 * Simulates human interaction patterns to avoid bot detection:
 * - Random delays between actions
 * - Mouse movement simulation
 * - Natural typing with variable speeds
 * - Scrolling behavior
 * - Random pauses and "thinking" time
 */

// ============================================================
// DELAY FUNCTIONS
// ============================================================

/**
 * Random delay between min and max milliseconds
 */
export function randomDelay(min = 100, max = 500) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Wait for a random amount of time
 */
export async function humanDelay(min = 100, max = 500) {
    const delay = randomDelay(min, max)
    await new Promise(resolve => setTimeout(resolve, delay))
    return delay
}

/**
 * Simulate "thinking" pause (longer delay)
 */
export async function thinkingPause() {
    return humanDelay(500, 2000)
}

/**
 * Short micro-pause between actions
 */
export async function microPause() {
    return humanDelay(50, 150)
}

// ============================================================
// MOUSE MOVEMENT SIMULATION
// ============================================================

/**
 * Generate a bezier curve path between two points
 */
function generateBezierPath(startX, startY, endX, endY, steps = 20) {
    const points = []

    // Random control points for natural curve
    const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 100
    const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 100
    const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 100
    const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 100

    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const t2 = t * t
        const t3 = t2 * t
        const mt = 1 - t
        const mt2 = mt * mt
        const mt3 = mt2 * mt

        const x = mt3 * startX + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * endX
        const y = mt3 * startY + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * endY

        points.push({ x: Math.round(x), y: Math.round(y) })
    }

    return points
}

/**
 * Move mouse to element with human-like curve
 */
export async function moveToElement(page, element, options = {}) {
    try {
        const box = await element.boundingBox()
        if (!box) return false

        // Random point within element (not exact center)
        const targetX = box.x + box.width * (0.3 + Math.random() * 0.4)
        const targetY = box.y + box.height * (0.3 + Math.random() * 0.4)

        // Get current mouse position (or start from random viewport position)
        const viewport = page.viewportSize() || { width: 1280, height: 720 }
        const startX = Math.random() * viewport.width
        const startY = Math.random() * viewport.height

        // Generate path
        const steps = options.fast ? 10 : 20
        const path = generateBezierPath(startX, startY, targetX, targetY, steps)

        // Move along path
        for (const point of path) {
            await page.mouse.move(point.x, point.y)
            await new Promise(r => setTimeout(r, randomDelay(5, 15)))
        }

        return true
    } catch (err) {
        return false
    }
}

/**
 * Click element with human-like behavior
 */
export async function humanClick(page, selector, options = {}) {
    try {
        const element = await page.$(selector)
        if (!element) return false

        // Scroll to element first
        await element.scrollIntoViewIfNeeded()
        await microPause()

        // Move mouse to element
        if (options.moveFirst !== false) {
            await moveToElement(page, element, options)
            await microPause()
        }

        // Small delay before click
        await humanDelay(50, 200)

        // Click with random offset
        const box = await element.boundingBox()
        if (box) {
            const offsetX = (Math.random() - 0.5) * box.width * 0.3
            const offsetY = (Math.random() - 0.5) * box.height * 0.3
            await element.click({
                position: {
                    x: box.width / 2 + offsetX,
                    y: box.height / 2 + offsetY,
                },
            })
        } else {
            await element.click()
        }

        return true
    } catch (err) {
        return false
    }
}

// ============================================================
// TYPING SIMULATION
// ============================================================

/**
 * Type text with human-like variable speed
 */
export async function humanType(page, selector, text, options = {}) {
    try {
        const element = await page.$(selector)
        if (!element) return false

        // Click to focus
        await element.click()
        await microPause()

        // Clear existing content if needed
        if (options.clear !== false) {
            await page.keyboard.press('Control+a')
            await microPause()
        }

        // Type each character with random delay
        const baseDelay = options.speed === 'fast' ? 20 : options.speed === 'slow' ? 80 : 40

        for (let i = 0; i < text.length; i++) {
            const char = text[i]

            // Variable delay based on character type
            let delay = baseDelay + randomDelay(0, baseDelay)

            // Slower for special characters
            if (/[^a-zA-Z0-9 ]/.test(char)) {
                delay *= 1.5
            }

            // Occasional longer pauses (thinking)
            if (Math.random() < 0.05) {
                delay += randomDelay(100, 300)
            }

            // Occasional typo and correction (realistic but can be disabled)
            if (options.typos !== false && Math.random() < 0.02 && i < text.length - 1) {
                // Type wrong character
                const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1))
                await page.keyboard.type(wrongChar)
                await new Promise(r => setTimeout(r, randomDelay(100, 300)))
                // Delete it
                await page.keyboard.press('Backspace')
                await new Promise(r => setTimeout(r, randomDelay(50, 150)))
            }

            await page.keyboard.type(char)
            await new Promise(r => setTimeout(r, delay))
        }

        return true
    } catch (err) {
        return false
    }
}

/**
 * Fill input with human-like behavior (simplified, faster)
 */
export async function humanFill(page, selector, text, options = {}) {
    try {
        const element = await page.$(selector)
        if (!element) return false

        // Scroll into view
        await element.scrollIntoViewIfNeeded()
        await microPause()

        // Click to focus
        await element.click()
        await humanDelay(100, 300)

        // Clear and type (using fill for speed, but with delays)
        await element.fill('')
        await humanDelay(50, 150)

        // Use native fill for the actual content (faster but still with pre/post delays)
        await element.fill(text)

        // Small pause after filling
        await humanDelay(100, 300)

        return true
    } catch (err) {
        return false
    }
}

// ============================================================
// SCROLLING BEHAVIOR
// ============================================================

/**
 * Scroll page naturally
 */
export async function humanScroll(page, options = {}) {
    const { direction = 'down', amount = 300, smooth = true } = options

    const scrollAmount = amount + randomDelay(-50, 50)
    const scrollDirection = direction === 'up' ? -1 : 1

    if (smooth) {
        // Smooth scroll in steps
        const steps = 10
        const stepAmount = scrollAmount / steps

        for (let i = 0; i < steps; i++) {
            await page.mouse.wheel(0, stepAmount * scrollDirection)
            await new Promise(r => setTimeout(r, randomDelay(10, 30)))
        }
    } else {
        await page.mouse.wheel(0, scrollAmount * scrollDirection)
    }

    await humanDelay(200, 500)
}

/**
 * Scroll to element naturally
 */
export async function scrollToElement(page, selector) {
    try {
        const element = await page.$(selector)
        if (!element) return false

        // Get element position
        const box = await element.boundingBox()
        if (!box) return false

        const viewport = page.viewportSize() || { width: 1280, height: 720 }

        // Scroll in chunks if element is far away
        const targetY = box.y - viewport.height / 3
        const currentScroll = await page.evaluate(() => window.scrollY)
        const scrollNeeded = targetY - currentScroll

        if (Math.abs(scrollNeeded) > 100) {
            const steps = Math.min(10, Math.ceil(Math.abs(scrollNeeded) / 200))
            const stepAmount = scrollNeeded / steps

            for (let i = 0; i < steps; i++) {
                await page.mouse.wheel(0, stepAmount)
                await humanDelay(50, 150)
            }
        }

        await humanDelay(200, 400)
        return true
    } catch (err) {
        return false
    }
}

// ============================================================
// FORM INTERACTION HELPERS
// ============================================================

/**
 * Fill a form field with full human-like behavior
 */
export async function humanFormFill(page, selector, value, options = {}) {
    // Scroll to field
    await scrollToElement(page, selector)

    // Use appropriate fill method based on options
    if (options.typeCharByChar) {
        return humanType(page, selector, value, options)
    } else {
        return humanFill(page, selector, value, options)
    }
}

/**
 * Submit form with human-like behavior
 */
export async function humanFormSubmit(page, buttonSelector) {
    // Small thinking pause before submit
    await thinkingPause()

    // Move to button and click
    const clicked = await humanClick(page, buttonSelector)

    if (!clicked) {
        // Try pressing Enter as fallback
        await page.keyboard.press('Enter')
    }

    // Wait after submit
    await humanDelay(500, 1000)

    return clicked
}

// ============================================================
// BEHAVIOR PROFILES
// ============================================================

/**
 * Predefined behavior profiles
 */
export const BEHAVIOR_PROFILES = {
    // Fast but still human-like
    fast: {
        delayMultiplier: 0.5,
        typingSpeed: 'fast',
        skipMouseMovement: true,
        typos: false,
    },

    // Normal human speed
    normal: {
        delayMultiplier: 1.0,
        typingSpeed: 'normal',
        skipMouseMovement: false,
        typos: false,
    },

    // Slow and careful (maximum stealth)
    careful: {
        delayMultiplier: 2.0,
        typingSpeed: 'slow',
        skipMouseMovement: false,
        typos: true,
    },

    // Aggressive (fast with minimal delays)
    aggressive: {
        delayMultiplier: 0.2,
        typingSpeed: 'fast',
        skipMouseMovement: true,
        typos: false,
    },
}

/**
 * Apply behavior profile to options
 */
export function applyBehaviorProfile(profile = 'normal') {
    return BEHAVIOR_PROFILES[profile] || BEHAVIOR_PROFILES.normal
}
