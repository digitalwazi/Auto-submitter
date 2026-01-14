
import { NextResponse } from 'next/server'
import { chromium } from 'playwright'

export async function GET() {
    let browser = null
    try {
        console.log('🔍 Running system diagnostics...')

        // 1. Check Node Environment
        const envInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cwd: process.cwd(),
        }

        // 2. Test Playwright Browser Launch
        const startTime = Date.now()
        console.log('   Attempting to launch browser...')

        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const context = await browser.newContext()
        const page = await context.newPage()

        console.log('   Browser launched successfully. Testing navigation...')

        // Test lightweight navigation (local or fast external)
        await page.goto('https://example.com', { timeout: 10000 })
        const title = await page.title()

        await browser.close()
        browser = null

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            status: 'HEALTHY',
            message: 'System is ready. Browser launched and navigated successfully.',
            details: {
                ...envInfo,
                browser: 'chromium',
                testPageTitle: title,
                launchDuration: `${duration}ms`
            }
        })

    } catch (error) {
        console.error('❌ Diagnostics failed:', error)

        if (browser) await browser.close().catch(() => { })

        let helpfulMessage = error.message
        let fixCommand = null

        // Diagnose common errors
        if (error.message.includes('executable doesn\'t exist')) {
            helpfulMessage = 'Playwright browsers are not installed.'
            fixCommand = 'npx playwright install chromium'
        } else if (error.message.includes('libraries') || error.message.includes('dependencies')) {
            helpfulMessage = 'System dependencies are missing (Linux/VPS).'
            fixCommand = 'npx playwright install-deps'
        }

        return NextResponse.json({
            success: false,
            status: 'ERROR',
            message: helpfulMessage,
            error: error.message,
            fixCommand: fixCommand,
            details: {
                stack: error.stack
            }
        }, { status: 500 })
    }
}
