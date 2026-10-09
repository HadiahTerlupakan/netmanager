/**
 * Cabut resource khusus sales (`m_presurvei`) dari role TEKNISI yang sudah ada.
 *
 * Seed sudah tidak lagi memberikannya ke TEKNISI (`RESOURCE_MOBILE_KHUSUS_SALES`),
 * tetapi seed hanya berlaku untuk environment baru — role yang terlanjur dibuat
 * di produksi masih memegangnya. Selama izin itu menempel, teknisi melihat
 * Presurvei, Tunggakan, Pelanggan Saya, dan Keluhan: empat fitur yang ketiganya
 * bergantung pada izin yang sama.
 *
 * Jalankan dengan `--apply` untuk benar-benar mencabut; tanpa flag itu skrip
 * hanya melaporkan apa yang akan dihapus.
 *
 *   npx tsx scripts/cabut-presurvei-dari-teknisi.ts
 *   npx tsx scripts/cabut-presurvei-dari-teknisi.ts --apply
 *
 * Catatan: daftar fitur ikut di dalam token sesi, jadi teknisi yang sedang
 * login harus login ulang sebelum perubahannya terasa.
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { runAsSystemContext } from "../lib/tenant-context";

const RESOURCE_KHUSUS_SALES = "m_presurvei";
const NAMA_ROLE_TEKNISI = "TEKNISI";

async function main() {
  const apply = process.argv.includes("--apply");

  // Skrip berjalan lintas tenant, jadi harus eksplisit minta konteks sistem.
  // Tanpa itu ekstensi isolasi tenant menolak query — perilaku yang memang
  // dikehendaki, bukan penghalang yang perlu diakali.
  await runAsSystemContext(
    "cabut resource khusus sales dari role TEKNISI",
    () => jalankan(apply),
  );
}

async function jalankan(apply: boolean) {
  const permissions = await prisma.permission.findMany({
    where: { resource: RESOURCE_KHUSUS_SALES },
    select: { id: true, name: true, tenantId: true },
  });

  if (permissions.length === 0) {
    logger.info(
      `Tidak ada permission dengan resource ${RESOURCE_KHUSUS_SALES}`,
    );
    return;
  }

  const roles = await prisma.role.findMany({
    where: {
      name: NAMA_ROLE_TEKNISI,
      permission: { some: { resource: RESOURCE_KHUSUS_SALES } },
    },
    select: {
      id: true,
      name: true,
      tenantId: true,
      permission: {
        where: { resource: RESOURCE_KHUSUS_SALES },
        select: { id: true, name: true },
      },
      _count: { select: { user: true } },
    },
  });

  if (roles.length === 0) {
    logger.info("Tidak ada role TEKNISI yang memegang resource khusus sales");
    return;
  }

  for (const role of roles) {
    const daftar = role.permission.map((p) => p.name).join(", ");
    logger.info(
      `[${apply ? "CABUT" : "RENCANA"}] role ${role.name} (tenant ${role.tenantId ?? "-"}, ${role._count.user} user): ${daftar}`,
    );

    if (!apply) continue;

    await prisma.role.update({
      where: { id: role.id },
      data: {
        permission: {
          disconnect: role.permission.map((p) => ({ id: p.id })),
        },
      },
    });
  }

  if (!apply) {
    logger.info("Mode kering. Tambahkan --apply untuk benar-benar mencabut.");
    return;
  }

  logger.info(
    "Selesai. Teknisi yang sedang login harus login ulang — daftar fitur ikut di token sesi.",
  );
}

main()
  .catch((error) => {
    logger.error("Gagal mencabut resource khusus sales:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
