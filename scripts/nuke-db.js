const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🗑️  STARTING FULL DATABASE RESET...')

    try {
        // Delete in order to respect foreign keys
        console.log('1. Deleting Logs & Submissions...')
        await prisma.submissionLog.deleteMany({})
        await prisma.campaignLog.deleteMany({})
        await prisma.processingQueue.deleteMany({})

        console.log('2. Deleting Extracted Data...')
        await prisma.pageDiscovery.deleteMany({})
        await prisma.extractedContact.deleteMany({})

        console.log('3. Deleting Domains (Wait for it)...')
        await prisma.domain.deleteMany({})

        console.log('4. Deleting Campaigns...')
        await prisma.campaign.deleteMany({})

        console.log('✅ DATABASE FLUSHED SUCCESSFULLY')
        console.log('You can now restart the system fresh.')

    } catch (error) {
        console.error('❌ Reset failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
