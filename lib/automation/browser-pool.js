import { chromium } from 'playwright'

let browserPool = []
const MAX_BROWSERS = 3

export async function getBrowserContext() {
    // Reuse existing browser or create new one
    if (browserPool.length > 0) {
        return browserPool.pop()
    }

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ],
    })

    return await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
}

export async function releaseBrowserContext(context) {
    if (browserPool.length < MAX_BROWSERS) {
        browserPool.push(context)
    } else {
        await context.browser().close()
    }
}
