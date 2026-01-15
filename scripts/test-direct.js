
import { submitForm } from '../lib/automation/form-submitter.js';
import { submitComment } from '../lib/automation/comment-submitter.js';

const TEST_URL = process.argv[2] || 'https://bundlewp.com/test-page/';

async function runTest() {
    console.log(`🚀 Starting debug test for: ${TEST_URL}`);

    // Mock campaign data
    const campaign = {
        id: 'debug-campaign-id',
        senderName: 'Test User',
        senderEmail: 'test@example.com',
        messageTemplate: 'This is a debug test submission.',
        submitForms: true,
        submitComments: true
    };

    const config = {
        saveScreenshots: false,
        skipDuplicates: false // DIRECT SUBMIT MODE
    };

    console.log('--- Testing FORM Submission ---');
    try {
        const result = await submitForm(
            TEST_URL,
            null, // Auto-detect form
            {
                name: campaign.senderName,
                email: campaign.senderEmail,
                message: campaign.messageTemplate,
            },
            {
                screenshots: config.saveScreenshots,
                skipDuplicates: config.skipDuplicates,
                campaignId: campaign.id,
                freshFingerprint: true
            }
        );
        console.log('FORM Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('FORM Error:', error);
    }

    console.log('\n--- Testing COMMENT Submission ---');
    try {
        const result = await submitComment(
            TEST_URL,
            null, // Auto-detect comment form
            {
                name: campaign.senderName,
                email: campaign.senderEmail,
                message: campaign.messageTemplate,
            }
        );
        console.log('COMMENT Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('COMMENT Error:', error);
    }

    console.log('\n🏁 Test Complete');
    process.exit(0);
}

runTest();
