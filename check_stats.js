const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking campaign stats...');

        const campaignId = 'cmkhfjsbm00003kyf4vmwp3if';

        // Check campaign status
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
        });
        console.log('Campaign:', campaign);

        if (!campaign) {
            console.log('Campaign not found');
            return;
        }

        // Check domain counts
        const counts = await prisma.domain.groupBy({
            by: ['status'],
            where: { campaignId: campaignId },
            _count: { status: true }
        });
        console.log('Domain Counts:', counts);

        // Check for any stuck 'PROCESSING' domains
        const stuck = await prisma.domain.findMany({
            where: {
                campaignId: campaignId,
                status: 'PROCESSING',
                updatedAt: {
                    lt: new Date(Date.now() - 15 * 60 * 1000) // Older than 15 mins
                }
            },
            take: 5
        });
        console.log('Stuck Domains (sample 5):', stuck.length);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
