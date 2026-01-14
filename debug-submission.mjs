/**
 * Debug Test Script - Tests the complete submission flow
 * Run with: node debug-submission.mjs
 */

import { submitForm } from './lib/automation/form-submitter.js'
import { submitComment } from './lib/automation/comment-submitter.js'
import { crawlPages } from './lib/crawler/page-crawler.js'

const TEST_DOMAINS = [
    'https://bundlewp.com',
    'https://cicadamania.com'
]

const TEST_DATA = {
    name: 'Test User',
    email: 'test@example.com',
    message: 'This is a test submission to verify the auto-submit system is working correctly.',
    senderName: 'Test User',
    senderEmail: 'test@example.com'
}

async function runTests() {
    console.log('='.repeat(60))
    console.log('🔍 AUTO-SUBMIT DEBUG TEST')
    console.log('='.repeat(60))

    // TEST 1: Direct Form Submission
    console.log('\n📝 TEST 1: Direct Form Submission')
    console.log('-'.repeat(40))

    try {
        console.log('Submitting form to bundlewp.com/contact...')
        const formResult = await submitForm(
            'https://bundlewp.com/contact',
            null, // formFields - let it auto-detect
            TEST_DATA, // submissionData
            { screenshots: true, skipDuplicates: false } // options
        )
        console.log('Form Result:', JSON.stringify(formResult, null, 2))

        if (formResult.success) {
            console.log('✅ FORM SUBMISSION: WORKING')
        } else {
            console.log('⚠️ FORM SUBMISSION: FAILED -', formResult.message)
        }
    } catch (error) {
        console.error('❌ FORM SUBMISSION: CRASHED -', error.message)
        console.error('Stack:', error.stack)
    }

    // TEST 2: Direct Comment Submission
    console.log('\n💬 TEST 2: Direct Comment Submission')
    console.log('-'.repeat(40))

    try {
        console.log('Submitting comment to cicadamania.com blog post...')
        const commentResult = await submitComment(
            'https://cicadamania.com/cicadas/cicadas-by-genus-and-species/',
            null, // commentFields
            TEST_DATA // submissionData
        )
        console.log('Comment Result:', JSON.stringify(commentResult, null, 2))

        if (commentResult.success) {
            console.log('✅ COMMENT SUBMISSION: WORKING')
        } else {
            console.log('⚠️ COMMENT SUBMISSION: FAILED -', commentResult.message)
        }
    } catch (error) {
        console.error('❌ COMMENT SUBMISSION: CRASHED -', error.message)
        console.error('Stack:', error.stack)
    }

    // TEST 3: Crawl + Check Form Detection
    console.log('\n🔍 TEST 3: Crawl & Form Detection')
    console.log('-'.repeat(40))

    try {
        console.log('Crawling bundlewp.com to detect forms...')
        const pages = await crawlPages('https://bundlewp.com', {
            maxPages: 5,
            detectForms: true,
            detectComments: true
        })

        const formsFound = pages.filter(p => p.forms?.length > 0).length
        const commentsFound = pages.filter(p => p.comments?.length > 0).length

        console.log(`Crawled ${pages.length} pages`)
        console.log(`Pages with forms: ${formsFound}`)
        console.log(`Pages with comments: ${commentsFound}`)

        if (formsFound > 0) {
            console.log('\nFirst form detected:')
            const formPage = pages.find(p => p.forms?.length > 0)
            console.log('  URL:', formPage.url)
            console.log('  Form fields:', formPage.forms[0]?.fields?.length || 0)
        }

        console.log('✅ CRAWLING: WORKING')
    } catch (error) {
        console.error('❌ CRAWLING: CRASHED -', error.message)
    }

    console.log('\n' + '='.repeat(60))
    console.log('🏁 TEST COMPLETE')
    console.log('='.repeat(60))

    process.exit(0)
}

runTests().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
