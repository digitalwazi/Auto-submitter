const express = require('express');
const { chromium } = require('playwright');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-secret-token';

// Middleware to check auth
function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (token !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'playwright-automation',
        timestamp: new Date().toISOString()
    });
});

// Form submission endpoint
app.post('/submit-form', authenticate, async (req, res) => {
    const { url, formFields, submissionData } = req.body;

    console.log(`[Form Submission] ${url}`);

    let browser, context, page;

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        page = await context.newPage();

        console.log(`  → Navigating to ${url}`);
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Fill form fields
        const filled = [];
        if (formFields?.fields) {
            for (const field of formFields.fields) {
                try {
                    const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`;
                    const value = getFieldValue(field, submissionData);

                    if (value) {
                        await page.fill(selector, value, { timeout: 3000 });
                        filled.push(field.name || field.id);
                        console.log(`  ✓ Filled: ${field.name}`);
                    }
                } catch (err) {
                    console.log(`  ✗ Failed to fill: ${field.name}`);
                }
            }
        }

        // Take screenshot before submit
        const beforeSS = await page.screenshot({ fullPage: false });

        // Find and click submit button
        console.log(`  → Submitting form...`);
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Send")',
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
            try {
                await page.click(selector, { timeout: 2000 });
                submitted = true;
                break;
            } catch (err) {
                continue;
            }
        }

        if (!submitted) {
            throw new Error('Submit button not found');
        }

        // Wait for response
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
        await page.waitForTimeout(2000);

        // Check for success
        const content = await page.content();
        const lowerContent = content.toLowerCase();

        const successKeywords = ['thank you', 'thanks', 'success', 'submitted', 'received'];
        const isSuccess = successKeywords.some(kw => lowerContent.includes(kw));
        message: error.message,
        });
    } finally {
    if (page) await page.close().catch(() => { });
    if (context) await context.close().catch(() => { });
    if (browser) await browser.close().catch(() => { });
}
});

// Comment submission endpoint
app.post('/submit-comment', authenticate, async (req, res) => {
    const { url, commentFields, submissionData } = req.body;

    console.log(`[Comment Submission] ${url}`);

    let browser, context, page;

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        page = await context.newPage();

        console.log(`  → Navigating to ${url}`);
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Fill comment fields
        const commentSelectors = ['#comment', '[name="comment"]', 'textarea'];
        const authorSelectors = ['#author', '[name="author"]', '#name', '[name="name"]'];
        const emailSelectors = ['#email', '[name="email"]'];

        for (const selector of commentSelectors) {
            try {
                await page.fill(selector, submissionData.message, { timeout: 2000 });
                console.log(`  ✓ Filled comment`);
                break;
            } catch (err) { }
        }

        for (const selector of authorSelectors) {
            try {
                await page.fill(selector, submissionData.name, { timeout: 2000 });
                console.log(`  ✓ Filled name`);
                break;
            } catch (err) { }
        }

        for (const selector of emailSelectors) {
            try {
                await page.fill(selector, submissionData.email, { timeout: 2000 });
                console.log(`  ✓ Filled email`);
                break;
            } catch (err) { }
        }

        // Submit
        console.log(`  → Submitting comment...`);
        const submitSelectors = ['#submit', '[name="submit"]', 'button[type="submit"]', 'input[type="submit"]'];

        let submitted = false;
        for (const selector of submitSelectors) {
            try {
                await page.click(selector, { timeout: 2000 });
                submitted = true;
                break;
            } catch (err) { }
        }

        if (!submitted) {
            throw new Error('Submit button not found');
        }

        await page.waitForTimeout(3000);

        console.log(`  ✅ Comment submitted`);

        res.json({
            success: true,
            status: 'SUCCESS',
            message: 'Comment submitted',
        });

    } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        res.status(500).json({
            success: false,
            status: 'FAILED',
            message: error.message,
        });
    } finally {
        if (page) await page.close().catch(() => { });
        if (context) await context.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
});

function getFieldValue(field, data) {
    const name = (field.name || field.id || '').toLowerCase();
    const label = (field.label || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const allText = `${name} ${label} ${placeholder}`;

    if (field.type === 'email' || allText.includes('email')) return data.email;
    if (allText.includes('name') && !allText.includes('user')) return data.name;
    if (allText.includes('subject')) return data.subject || 'Contact Inquiry';
    if (allText.includes('phone') || allText.includes('tel')) return data.phone || '';
    if (allText.includes('message') || allText.includes('comment') || field.tagName === 'textarea') return data.message;
    if (allText.includes('website') || allText.includes('url')) return data.website || '';

    return null;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Playwright service running on port ${PORT}`);
    console.log(`📝 Auth token: ${AUTH_TOKEN.substring(0, 10)}...`);
});
