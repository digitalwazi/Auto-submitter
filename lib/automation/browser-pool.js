import { chromium } from 'playwright'

let browserInstance = null
let contextPool = []
const MAX_CONTEXTS = 3

export async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
    }
    return browserInstance
}

export async function getContext() {
    // Reuse existing context if available
    if (contextPool.length > 0) {
        return contextPool.pop()
    }

    // Create new context if under limit
    if (contextPool.length < MAX_CONTEXTS) {
        const browser = await getBrowser()
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
        })
        return context
    }

    // Wait for context to become available
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (contextPool.length > 0) {
                clearInterval(checkInterval)
                resolve(contextPool.pop())
            }
        }, 500)
    })
}

export async function releaseContext(context) {
    // Clear cookies and storage
    await context.clearCookies()

    // Return to pool
    if (contextPool.length < MAX_CONTEXTS) {
        contextPool.push(context)
    } else {
        await context.close()
    }
}

export async function closeBrowser() {
    // Close all contexts
    for (const context of contextPool) {
        await context.close()
    }
    contextPool = []

    // Close browser
    if (browserInstance) {
        await browserInstance.close()
        browserInstance = null
    }
}

// Cleanup on process exit
process.on('SIGINT', async () => {
    await closeBrowser()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    await closeBrowser()
    process.exit(0)
})
