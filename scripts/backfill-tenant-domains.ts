process.env.IS_SEEDING = "true";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  buildSlugCandidate,
  buildSlugVariant,
  isReservedSlug,
} from "../modules/tenant/services/tenant-slug";
import { logger } from "../lib/logger";

/**
 * Isi baris `TenantDomain` untuk tenant yang dibuat sebelum baris itu ikut
 * dibentuk otomatis.
 *
 * Tanpa baris ini tenant tidak punya subdomain slug maupun jalur domain
 * kustom — resolusi tenant, verifikasi DNS, dan penerbitan SSL semuanya
 * membaca tabel yang sama.
 *
 * Idempoten: tenant yang sudah punya baris dilewati.
 */

const MAX_SLUG_ATTEMPTS = 50;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  return { client, pool };
}

const { client: prisma, pool } = createPrismaClient();

async function reserveAvailableSlug(tenantName: string): Promise<string> {
  const candidate = buildSlugCandidate(tenantName);

  for (let attempt = 0; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug =
      attempt === 0 ? candidate : buildSlugVariant(candidate, attempt);

    if (isReservedSlug(slug)) continue;

    const taken = await prisma.tenantDomain.findUnique({ where: { slug } });
    if (!taken) return slug;
  }

  throw new Error(`Tidak menemukan slug tersedia untuk "${tenantName}"`);
}

async function backfillTenantDomains() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, domain: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const existing = await prisma.tenantDomain.findUnique({
      where: { tenantId: tenant.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const slug = await reserveAvailableSlug(tenant.name);
    await prisma.tenantDomain.create({
      data: { tenantId: tenant.id, slug },
    });

    created++;
    logger.info(`[BackfillTenantDomain] ${tenant.name} -> ${slug}`);

    // `Tenant.domain` (field lama) hanya membuat resolusi tenant menemukan
    // host itu; ia tidak pernah memicu verifikasi maupun SSL. Dilaporkan
    // supaya operator tahu domain mana yang masih perlu didaftarkan ulang
    // lewat alur domain kustom.
    if (tenant.domain) {
      logger.warn(
        `[BackfillTenantDomain] ${tenant.name} punya domain lama "${tenant.domain}" — daftarkan ulang lewat halaman Domain agar diverifikasi dan dapat SSL`,
      );
    }
  }

  logger.info(
    `[BackfillTenantDomain] selesai: ${created} dibuat, ${skipped} dilewati, ${tenants.length} tenant diperiksa`,
  );
}

backfillTenantDomains()
  .catch((error) => {
    logger.error("[BackfillTenantDomain] gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
