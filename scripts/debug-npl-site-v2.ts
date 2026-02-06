import { prisma } from "../lib/prisma";

async function main() {
  console.log("--- NPL Site Debugging V2 ---");

  // 1. Check MixRadiusCustomer count and samples
  const mixCustomerCount = await prisma.mixRadiusCustomer.count();
  console.log(`Total MixRadiusCustomer records: ${mixCustomerCount}`);

  if (mixCustomerCount > 0) {
    const samples = await prisma.mixRadiusCustomer.findMany({
      take: 5,
      select: { username: true, mixRadiusId: true }
    });
    console.log("Sample MixRadiusCustomer usernames:");
    console.table(samples);
  }

  // 2. Check Pelanggan count and samples
  const pelangganCount = await prisma.pelanggan.count();
  console.log(`Total Pelanggan records: ${pelangganCount}`);

  const linkedCount = await prisma.pelanggan.count({
    where: { mixRadiusId: { not: null } }
  });
  console.log(`Pelanggan with mixRadiusId: ${linkedCount}`);

  if (pelangganCount > 0) {
     const samples = await prisma.pelanggan.findMany({
      take: 5,
      select: { idPelanggan: true, mixRadiusId: true, siteId: true }
    });
    console.log("Sample Pelanggan records:");
    console.table(samples);
  }

  // 3. Check for potential matches
  if (mixCustomerCount > 0 && pelangganCount > 0) {
    const allPelangganUsernames = await prisma.pelanggan.findMany({
        select: { idPelanggan: true }
    });
    const usernames = allPelangganUsernames.map(p => p.idPelanggan);
    
    const matches = await prisma.mixRadiusCustomer.count({
        where: { username: { in: usernames } }
    });
    console.log(`Potential matches by username (idPelanggan): ${matches}`);
  }
  
  // 4. Check Sites and Groups mapping
  const groups = await prisma.mixRadiusOwnerGroup.findMany({
      include: { site: true }
  });
  console.log("Owner Groups Mapping:");
  groups.forEach(g => {
      console.log(`- Group: ${g.name}, Site: ${g.site?.name || 'None'} (siteId: ${g.siteId})`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
