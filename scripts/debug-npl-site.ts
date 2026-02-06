import { prisma } from "../lib/prisma";

async function main() {
  console.log("--- NPL Site Debugging ---");

  // 1. Fetch a MixRadiusOwnerGroup
  const groups = await prisma.mixRadiusOwnerGroup.findMany({
    where: { siteId: { not: null } },
    include: { site: true }
  });

  if (groups.length === 0) {
    console.log("No MixRadiusOwnerGroup with siteId found.");
    return;
  }

  const group = groups[0];
  console.log(`Testing Group: ${group.name} (ID: ${group.id})`);
  console.log(`Linked Site: ${group.site?.name} (ID: ${group.siteId})`);

  // 2. Query Pelanggan linked to this site
  const pelangganCount = await prisma.pelanggan.count({
    where: { siteId: group.siteId }
  });
  console.log(`Local Pelanggan count for this site: ${pelangganCount}`);

  // 3. Check mixRadiusId population
  const pelangganWithMixId = await prisma.pelanggan.findMany({
    where: { siteId: group.siteId, mixRadiusId: { not: null } },
    select: { idPelanggan: true, mixRadiusId: true }
  });
  console.log(`Pelanggan with mixRadiusId: ${pelangganWithMixId.length}`);

  if (pelangganWithMixId.length > 0) {
    console.log("Sample mappings:");
    console.table(pelangganWithMixId.slice(0, 5));

    const ids = pelangganWithMixId.map(p => p.mixRadiusId as string);
    
    // 4. Check if these IDs exist in MixRadiusCustomer table
    const mixRadiusCustomerCount = await prisma.mixRadiusCustomer.count({
      where: { mixRadiusId: { in: ids } }
    });
    console.log(`Existing MixRadiusCustomer records for these IDs: ${mixRadiusCustomerCount}`);
    
    // 5. Check if any are expired (proxy for NPL)
    const now = new Date();
    const expiredCount = await prisma.mixRadiusCustomer.count({
      where: {
        mixRadiusId: { in: ids },
        expiredOn: { lt: now },
        status: { in: ["Enabled-Users", "Disabled-Users"] }
      }
    });
    console.log(`Expired MixRadiusCustomer records (NPL candidates): ${expiredCount}`);
  } else if (pelangganCount > 0) {
    console.log("CRITICAL: Pelanggan found but NONE have mixRadiusId linked.");
    
    // Try to see if they HAVE usernames that match MixRadiusCustomer
    const sampleUsernames = await prisma.pelanggan.findMany({
      where: { siteId: group.siteId },
      select: { idPelanggan: true },
      take: 5
    });
    const usernames = sampleUsernames.map(p => p.idPelanggan);
    console.log(`Sample local idPelanggan: ${usernames.join(", ")}`);
    
    const matchingMixCustomers = await prisma.mixRadiusCustomer.findMany({
      where: { username: { in: usernames } },
      select: { username: true, mixRadiusId: true }
    });
    console.log(`Matching MixRadiusCustomer by username: ${matchingMixCustomers.length}`);
    if (matchingMixCustomers.length > 0) {
      console.log("Mismatched data: Usernames match but mixRadiusId is missing in Pelanggan table.");
    }
  }

  // 6. Simulate getNPLStatistics logic
  const customersInSite = await prisma.pelanggan.findMany({
    where: { siteId: group.siteId, mixRadiusId: { not: null } },
    select: { mixRadiusId: true }
  });
  
  const mixRadiusIds = customersInSite.map(c => c.mixRadiusId as string);
  console.log(`Final filter ID count for getNPLStatistics: ${mixRadiusIds.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
