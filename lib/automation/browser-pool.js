import { chromium } from 'playwright'
import { getRandomUserAgent } from '../utils/user-agents.js'

const MAX_BROWSERS = 5
const activeBrowsers = []
const availableContexts = []

// ============================================================
// FINGERPRINT RANDOMIZATION
// ============================================================

/**
 * Random viewport sizes (common desktop resolutions)
 */
const VIEWPORT_SIZES = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
    { width: 1680, height: 1050 },
    { width: 1920, height: 1200 },
    { width: 2560, height: 1440 },
]

/**
 * Random timezones
 */
const TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
]

/**
 * Random locales
 */
const LOCALES = [
    'en-US',
    'en-GB',
    'en-AU',
    'en-CA',
]

/**
 * Random color schemes
 */
const COLOR_SCHEMES = ['light', 'dark', 'no-preference']

/**
 * Device scale factors
 */
const SCALE_FACTORS = [1, 1.25, 1.5, 2]

/**
 * Generate random fingerprint configuration
 */
export function generateRandomFingerprint() {
    const viewport = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)]
    const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]
    const locale = LOCALES[Math.floor(Math.random() * LOCALES.length)]
    const colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)]
    const scaleFactor = SCALE_FACTORS[Math.floor(Math.random() * SCALE_FACTORS.length)]

    return {
        userAgent: getRandomUserAgent(),
        viewport,
        timezoneId: timezone,
        locale,
        colorScheme,
        deviceScaleFactor: scaleFactor,
        hasTouch: false,
        isMobile: false,
        // Extra fingerprint properties
        screenWidth: viewport.width + Math.floor(Math.random() * 100),
        screenHeight: viewport.height + Math.floor(Math.random() * 100),
        hardwareConcurrency: [2, 4, 6, 8, 12, 16][Math.floor(Math.random() * 6)],
        deviceMemory: [2, 4, 8, 16, 32][Math.floor(Math.random() * 5)],
    }
}

// ============================================================
// SECURITY PATTERNS
// ============================================================

// Dangerous URL patterns to block
const DANGEROUS_PATTERNS = [
    /\.exe(\?|$)/i,
    /\.msi(\?|$)/i,
    /\.bat(\?|$)/i,
    /\.cmd(\?|$)/i,
    /\.scr(\?|$)/i,
    /\.dll(\?|$)/i,
    /\.vbs(\?|$)/i,
    /\.ps1(\?|$)/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /data:application/i,
]

// Check if URL is safe to visit
export function isUrlSafe(url) {
    if (!url) return false
    return !DANGEROUS_PATTERNS.some(pattern => pattern.test(url))
}

// ============================================================
// BROWSER POOL MANAGEMENT
// ============================================================

export async function getBrowserContext(options = {}) {
    // Reuse available context
    if (availableContexts.length > 0 && !options.newFingerprint) {
        return availableContexts.pop()
    }

    // Create new browser if under limit
    if (activeBrowsers.length < MAX_BROWSERS) {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-popup-blocking',
                '--disable-notifications',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security=false',
                '--block-new-web-contents',  // Block popups
            ]
        })

        activeBrowsers.push(browser)

        // Generate random fingerprint
        const fingerprint = options.fingerprint || generateRandomFingerprint()

        const context = await browser.newContext({
            userAgent: fingerprint.userAgent,
            acceptDownloads: false,
            javaScriptEnabled: true,
            permissions: [],
            bypassCSP: false,
            ignoreHTTPSErrors: false,
            locale: fingerprint.locale,
            timezoneId: fingerprint.timezoneId,
            viewport: fingerprint.viewport,
            deviceScaleFactor: fingerprint.deviceScaleFactor,
            hasTouch: fingerprint.hasTouch,
            isMobile: fingerprint.isMobile,
            colorScheme: fingerprint.colorScheme,
        })

        // Inject fingerprint masking scripts
        await context.addInitScript((fp) => {
            // Override navigator properties
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => fp.hardwareConcurrency,
            })
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => fp.deviceMemory,
            })
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            })

            // Override screen properties
            Object.defineProperty(screen, 'width', {
                get: () => fp.screenWidth,
            })
            Object.defineProperty(screen, 'height', {
                get: () => fp.screenHeight,
            })
            Object.defineProperty(screen, 'availWidth', {
                get: () => fp.screenWidth,
            })
            Object.defineProperty(screen, 'availHeight', {
                get: () => fp.screenHeight - 40,
            })

            // Mask automation detection
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol

            // Override plugins to look more realistic
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    return [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' },
                    ]
                },
            })

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => [fp.locale, 'en'],
            })

            // Canvas fingerprint randomization (slight noise)
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                if (type === 'image/png' || type === 'image/jpeg') {
                    const context = this.getContext('2d')
                    const imageData = context.getImageData(0, 0, this.width, this.height)
                    // Add slight random noise
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] += Math.floor(Math.random() * 2) - 1
                    }
                    context.putImageData(imageData, 0, 0)
                }
                return originalToDataURL.apply(this, arguments)
            }

            // WebGL fingerprint masking
            const getParameterProxyHandler = {
                apply: function (target, thisArg, argumentsList) {
                    const param = argumentsList[0]
                    // Add randomness to certain parameters
                    if (param === 37445 || param === 37446) { // UNMASKED_VENDOR/RENDERER
                        return 'Intel Inc.~Intel(R) UHD Graphics'
                    }
                    return Reflect.apply(target, thisArg, argumentsList)
                }
            }

            try {
                const canvas = document.createElement('canvas')
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
                if (gl) {
                    gl.getParameter = new Proxy(gl.getParameter, getParameterProxyHandler)
                }
            } catch (e) { }

        }, fingerprint)

        // Block dangerous resource types
        await context.route('**/*', async route => {
            const request = route.request()
            const url = request.url()
            const resourceType = request.resourceType()

            // Block dangerous URLs
            if (!isUrlSafe(url)) {
                console.log(`🛡️ BLOCKED dangerous URL: ${url}`)
                await route.abort('blockedbyclient')
                return
            }

            // Block unnecessary resources (faster + safer)
            if (['media', 'font', 'websocket'].includes(resourceType)) {
                await route.abort('blockedbyclient')
                return
            }

            // Block suspicious file downloads
            if (url.match(/\.(zip|rar|7z|tar|gz|exe|msi|dmg|pkg|deb|rpm)(\?|$)/i)) {
                console.log(`🛡️ BLOCKED file download: ${url}`)
                await route.abort('blockedbyclient')
                return
            }

            await route.continue()
        })

        // Store fingerprint in context for reference
        context._fingerprint = fingerprint

        return context
    }

    // Wait for available context
    await new Promise(resolve => setTimeout(resolve, 1000))
    return getBrowserContext(options)
}

export async function releaseBrowserContext(context) {
    try {
        // Clear cookies/storage for safety
        await context.clearCookies()
        availableContexts.push(context)
    } catch (error) {
        // Context might be closed, that's okay
    }
}

export async function closeAllBrowsers() {
    for (const browser of activeBrowsers) {
        try {
            await browser.close()
        } catch (error) {
            // Browser might already be closed
        }
    }
    activeBrowsers.length = 0
    availableContexts.length = 0
}

// Safe page navigation with timeout and error handling
export async function safeNavigate(page, url, options = {}) {
    // Check URL safety first
    if (!isUrlSafe(url)) {
        console.log(`🛡️ REFUSED to navigate to dangerous URL: ${url}`)
        return { success: false, error: 'Dangerous URL blocked' }
    }

    try {
        // Block popup windows
        page.on('popup', async popup => {
            console.log(`🛡️ BLOCKED popup window`)
            await popup.close().catch(() => { })
        })

        // Navigate with timeout
        await page.goto(url, {
            timeout: options.timeout || 30000,
            waitUntil: options.waitUntil || 'domcontentloaded',
        })

        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

/**
 * Get current fingerprint info for a context
 */
export function getContextFingerprint(context) {
    return context._fingerprint || null
}

/**
 * Create a new context with fresh fingerprint (for stealth mode)
 */
export async function getFreshContext() {
    return getBrowserContext({ newFingerprint: true })
}
