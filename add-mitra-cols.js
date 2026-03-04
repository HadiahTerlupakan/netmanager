/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('./prisma/generated/mitra');
const prisma = new PrismaClient();
async function main() {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "mixradiusOwnerNames" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "mitraRateFeePelanggan" DOUBLE PRECISION;`);
    console.log("Done");
}
main().catch(console.error).finally(() => prisma.$disconnect());
