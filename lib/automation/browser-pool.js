import { chromium } from 'playwright'
import { getRandomUserAgent } from '../utils/user-agents.js'

const MAX_BROWSERS = 5
const activeBrowsers = []
const availableContexts = []

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

export async function getBrowserContext() {
    // Reuse available context
    if (availableContexts.length > 0) {
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

        const context = await browser.newContext({
            userAgent: getRandomUserAgent(),
            acceptDownloads: false,          // ← BLOCK all downloads
            javaScriptEnabled: true,
            permissions: [],                  // ← NO permissions granted
            bypassCSP: false,                // ← Keep Content Security Policy
            ignoreHTTPSErrors: false,        // ← Enforce HTTPS security
            locale: 'en-US',
            timezoneId: 'America/New_York',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            hasTouch: false,
            isMobile: false,
        })

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

        return context
    }

    // Wait for available context
    await new Promise(resolve => setTimeout(resolve, 1000))
    return getBrowserContext()
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
