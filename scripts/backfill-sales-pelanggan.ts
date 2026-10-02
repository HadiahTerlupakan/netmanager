process.env.IS_SEEDING = "true";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Impor file langsung (bukan index modul) agar skrip tidak ikut memuat event bus / Redis.
import { CanvasingSalesLookupRepository } from "../modules/marketing/repositories/CanvasingSalesLookupRepository";
import { PelangganSalesRepository } from "../modules/pelanggan/repositories/PelangganSalesRepository";
import { PelangganSalesService } from "../modules/pelanggan/services/PelangganSalesService";

/**
 * Isi `Pelanggan.salesId` untuk pelanggan yang belum punya sales penanggung jawab
 * (mis. hasil impor massal), memakai aturan yang sama dengan form pelanggan baru:
 * sales dari canvasing APPROVED dengan nomor HP sama, hanya bila tepat satu sales
 * aktif yang cocok. Pelanggan yang ambigu / tak cocok dibiarkan untuk diisi admin.
 *
 * Bawaan dry-run (hanya laporan). Tulis perubahan dengan `--apply`:
 *   npx tsx scripts/backfill-sales-pelanggan.ts            # laporan
 *   npx tsx scripts/backfill-sales-pelanggan.ts --apply    # tulis
 * Idempoten: hanya menyentuh pelanggan yang salesId-nya masih kosong.
 */

const IS_TULIS = process.argv.includes("--apply");

function buatPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  return { client: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

/** Isi sales satu tenant; mengembalikan jumlah [cocok, tanpa kecocokan]. */
async function isiSalesTenant(
  tenantId: string,
  repository: PelangganSalesRepository,
  service: PelangganSalesService,
): Promise<[number, number]> {
  let cocok = 0;
  let tanpaKecocokan = 0;
  for (const pelanggan of await repository.daftarPelangganTanpaSales(tenantId)) {
    const salesId = await service.tentukanSalesPelangganBaru(tenantId, { noTelp: pelanggan.noTelp });
    if (!salesId) {
      tanpaKecocokan += 1;
      continue;
    }
    cocok += 1;
    if (IS_TULIS) await repository.tetapkanSales(tenantId, pelanggan.id, salesId);
  }
  return [cocok, tanpaKecocokan];
}

async function main() {
  const { client, pool } = buatPrismaClient();
  try {
    const repository = new PelangganSalesRepository(client);
    const lookup = new CanvasingSalesLookupRepository(client);
    const service = new PelangganSalesService(repository, (tenantId, noTelp) =>
      lookup.cariSalesDariTelepon(tenantId, noTelp),
    );
    for (const tenantId of await repository.daftarTenantPelangganTanpaSales()) {
      const [cocok, tanpaKecocokan] = await isiSalesTenant(tenantId, repository, service);
      console.log(
        `[${IS_TULIS ? "APPLY" : "DRY-RUN"}] tenant ${tenantId}: ${cocok} diisi dari canvasing, ${tanpaKecocokan} perlu diisi admin`,
      );
    }
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[backfill-sales-pelanggan] gagal:", error);
  process.exit(1);
});
