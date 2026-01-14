const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                _count: {
                    select: { domains: true }
                }
            }
        });

        console.log('\n=== RECENT CAMPAIGNS ===');
        for (const c of campaigns) {
            console.log(`[${c.status}] ${c.id} - ${c.name} (${c._count.domains} domains)`);

            const domains = await prisma.domain.findMany({
                where: { campaignId: c.id },
                select: { id: true, url: true, status: true, workerId: true, error: true }
            });

            console.log('  Domains:');
            domains.forEach(d => {
                console.log(`    [${d.status}] ${d.url} ${d.error ? `(Error: ${d.error})` : ''}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
