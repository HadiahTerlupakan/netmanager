/**
 * Seed default TaxRateConfig untuk semua tenant.
 *
 * Idempotent: cek (tenantId, code) sebelum insert. Pakai default standar
 * Indonesia untuk tenant baru — tarif bisa di-edit operator di
 * `/admin/pajak/konfigurasi` tab "Tarif Pajak per Jenis".
 *
 * Run: IS_SEEDING=true npx tsx prisma/seed-tax-rate-configs.ts
 */
import { prisma } from "@/lib/prisma";
import type { TaxRateCategory } from "@prisma/client";

interface RateSeed {
  code: string;
  name: string;
  category: TaxRateCategory;
  rate: number;
  dueDay: number | null;
  dueMonth: number | null;
  description: string;
  sortOrder: number;
}

const DEFAULT_RATES: RateSeed[] = [
  {
    code: "PPN",
    name: "PPN",
    category: "PPN",
    rate: 11,
    dueDay: 15,
    dueMonth: null,
    description: "Pajak Pertambahan Nilai. Tarif standar Indonesia 11%.",
    sortOrder: 10,
  },
  {
    code: "PPH23_JASA",
    name: "PPh 23 Jasa",
    category: "PPH",
    rate: 2,
    dueDay: 10,
    dueMonth: null,
    description: "PPh Pasal 23 untuk imbalan jasa. Tarif 2% dari DPP.",
    sortOrder: 20,
  },
  {
    code: "PPH23_SEWA",
    name: "PPh 23 Sewa",
    category: "PPH",
    rate: 2,
    dueDay: 10,
    dueMonth: null,
    description:
      "PPh Pasal 23 untuk sewa selain tanah/bangunan. Tarif 2% dari DPP.",
    sortOrder: 21,
  },
  {
    code: "PPH4_FINAL",
    name: "PPh 4(2) Sewa Tanah/Bangunan",
    category: "PPH",
    rate: 10,
    dueDay: 10,
    dueMonth: null,
    description: "PPh Pasal 4(2) final untuk sewa tanah/bangunan. Tarif 10%.",
    sortOrder: 22,
  },
  {
    code: "PPH21",
    name: "PPh 21",
    category: "PPH",
    rate: 0,
    dueDay: 10,
    dueMonth: null,
    description: "PPh Pasal 21 untuk gaji karyawan. Tarif progresif via TER.",
    sortOrder: 23,
  },
  {
    code: "BHP",
    name: "BHP",
    category: "BHP_USO",
    rate: 0.5,
    dueDay: null,
    dueMonth: 4,
    description:
      "Biaya Hak Penggunaan frekuensi/spektrum. Tarif 0.5% pendapatan kotor.",
    sortOrder: 30,
  },
  {
    code: "USO",
    name: "USO",
    category: "BHP_USO",
    rate: 1.25,
    dueDay: null,
    dueMonth: 4,
    description: "Universal Service Obligation. Tarif 1.25% pendapatan kotor.",
    sortOrder: 31,
  },
];

async function seedRatesForTenant(tenantId: string): Promise<void> {
  for (const seed of DEFAULT_RATES) {
    const existing = await prisma.taxRateConfig.findUnique({
      where: { tenantId_code: { tenantId, code: seed.code } },
    });
    if (existing) {
      console.log(
        `[seed-tax-rates] tenant=${tenantId} code=${seed.code} exists, skip`,
      );
      continue;
    }

    await prisma.taxRateConfig.create({
      data: {
        tenantId,
        code: seed.code,
        name: seed.name,
        category: seed.category,
        rate: seed.rate,
        dueDay: seed.dueDay,
        dueMonth: seed.dueMonth,
        description: seed.description,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });
    console.log(
      `[seed-tax-rates] tenant=${tenantId} code=${seed.code} created rate=${seed.rate}`,
    );
  }
}

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  });
  if (tenants.length === 0) {
    console.log("[seed-tax-rates] no tenant found, abort");
    return;
  }

  for (const tenant of tenants) {
    console.log(`\n[seed-tax-rates] tenant=${tenant.name} (${tenant.id})`);
    await seedRatesForTenant(tenant.id);
  }

  console.log("\n[seed-tax-rates] done");
}

main()
  .catch((e) => {
    console.error("[seed-tax-rates] FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
