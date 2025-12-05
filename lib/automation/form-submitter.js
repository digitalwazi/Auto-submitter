// Simple HTTP-based form submission for Vercel
// Calls external Playwright service on Render for browser automation

export async function submitForm(url, formFields, submissionData) {
    const playwrightServiceUrl = process.env.PLAYWRIGHT_SERVICE_URL;
    const authToken = process.env.PLAYWRIGHT_AUTH_TOKEN;

    if (!playwrightServiceUrl) {
        console.warn('PLAYWRIGHT_SERVICE_URL not configured, skipping form submission');
        return {
            success: false,
            status: 'SKIPPED',
            message: 'Playwright service not configured',
        };
    }

    try {
        console.log(`Submitting form to Playwright service: ${url}`);

        const response = await fetch(`${playwrightServiceUrl}/submit-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                url,
                formFields,
                submissionData,
            }),
            signal: AbortSignal.timeout(60000), // 60s timeout
        });

        if (!response.ok) {
            throw new Error(`Service returned ${response.status}`);
        }

        const result = await response.json();
        console.log(`Form submission result: ${result.status}`);

        return result;

    } catch (error) {
        console.error(`Form submission error: ${error.message}`);

        return {
            success: false,
            status: 'FAILED',
            message: `Service error: ${error.message}`,
        };
    }
}
