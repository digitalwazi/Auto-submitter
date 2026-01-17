const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const campaignId = 'cmkhfjsbm00003kyf4vmwp3if'
    const stats = await prisma.campaignDomain.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: {
            _all: true
        }
    })
    console.log('Campaign Stats:', JSON.stringify(stats, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
