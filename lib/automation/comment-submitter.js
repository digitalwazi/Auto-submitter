// Simple HTTP-based comment submission for Vercel
// Calls external Playwright service on Render for browser automation

export async function submitComment(url, commentFields, submissionData) {
    const playwrightServiceUrl = process.env.PLAYWRIGHT_SERVICE_URL;
    const authToken = process.env.PLAYWRIGHT_AUTH_TOKEN;

    if (!playwrightServiceUrl) {
        console.warn('PLAYWRIGHT_SERVICE_URL not configured, skipping comment submission');
        return {
            success: false,
            status: 'SKIPPED',
            message: 'Playwright service not configured',
        };
    }

    try {
        console.log(`Submitting comment to Playwright service: ${url}`);

        const response = await fetch(`${playwrightServiceUrl}/submit-comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                url,
                commentFields,
                submissionData,
            }),
            signal: AbortSignal.timeout(60000), // 60s timeout
        });

        if (!response.ok) {
            throw new Error(`Service returned ${response.status}`);
        }

        const result = await response.json();
        console.log(`Comment submission result: ${result.status}`);

        return result;

    } catch (error) {
        console.error(`Comment submission error: ${error.message}`);

        return {
            success: false,
            status: 'FAILED',
            message: `Service error: ${error.message}`,
        };
    }
}
