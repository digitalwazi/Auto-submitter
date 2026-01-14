// Quick test script for form submission
import { submitForm } from './lib/automation/form-submitter.js'

async function test() {
    console.log('Testing form submission on bundlewp.com...')

    try {
        const result = await submitForm(
            'https://bundlewp.com/contact',
            null, // formFields (let it auto-detect)
            {     // submissionData
                name: 'Test User',
                email: 'test@example.com',
                message: 'This is a test submission to verify the system is working.',
            },
            {     // options
                screenshots: true,
                skipDuplicates: false,
            }
        )

        console.log('Result:', JSON.stringify(result, null, 2))

        if (result.success) {
            console.log('✅ FORM SUBMISSION WORKS!')
        } else {
            console.log('⚠️ Submission returned:', result.status, result.message)
        }
    } catch (error) {
        console.error('❌ Error:', error.message)
    }

    process.exit(0)
}

test()
