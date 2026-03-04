import { prismaMitra } from './lib/prisma-mitra';

async function main() {
    await prismaMitra.$executeRawUnsafe(`ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "mixradiusOwnerNames" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await prismaMitra.$executeRawUnsafe(`ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "mitraRateFeePelanggan" DOUBLE PRECISION;`);
    await prismaMitra.$executeRawUnsafe(`ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "enableFeePelanggan" BOOLEAN NOT NULL DEFAULT false;`);
    console.log("Done");
}
main().catch(console.error).finally(() => prismaMitra.$disconnect());
