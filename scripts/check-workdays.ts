import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Bypass tenant isolation untuk script maintenance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkWorkDays() {
  const users = await prisma.user.findMany({
    where: { workDays: { not: null } },
    select: { workDays: true, name: true, id: true },
  });

  const grouped = users.reduce(
    (acc, user) => {
      const wd = user.workDays || "null";
      if (!acc[wd]) acc[wd] = { count: 0, samples: [] };
      acc[wd].count++;
      if (acc[wd].samples.length < 3) acc[wd].samples.push(user.name);
      return acc;
    },
    {} as Record<string, { count: number; samples: string[] }>,
  );

  console.log("=== Existing workDays Formats ===");
  console.log(`Total users with workDays: ${users.length}\n`);

  Object.entries(grouped)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([format, data]) => {
      console.log(`Format: "${format}"`);
      console.log(`  Count: ${data.count}`);
      console.log(`  Samples: ${data.samples.join(", ")}`);
      console.log("");
    });

  await prisma.$disconnect();
}

checkWorkDays().catch(console.error);
