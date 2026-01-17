const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const campaignId = 'cmkhfjsbm00003kyf4vmwp3if';

    console.log('🔄 Starting repair...');

    // 1. Reset stuck domains
    const stuck = await prisma.domain.updateMany({
        where: {
            campaignId: campaignId,
            status: 'PROCESSING',
            updatedAt: {
                lt: new Date(Date.now() - 5 * 60 * 1000) // Older than 5 mins
            }
        },
        data: {
            status: 'PENDING'
        }
    });
    console.log(`✅ Reset ${stuck.count} stuck domains to PENDING`);

    // 2. Count actual completed domains
    const completedCount = await prisma.domain.count({
        where: {
            campaignId: campaignId,
            status: 'COMPLETED'
        }
    });
    console.log(`📊 Found ${completedCount} actually completed domains`);

    // 3. Update campaign counter
    await prisma.campaign.update({
        where: { id: campaignId },
        data: {
            processedDomains: completedCount
        }
    });
    console.log(`✅ Synced campaign counter to ${completedCount}`);
}

main()
    .catch(e => console.error('Error:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
