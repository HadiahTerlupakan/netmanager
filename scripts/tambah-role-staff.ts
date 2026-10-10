/**
 * Buat (atau selaraskan) role STAFF di tiap tenant yang belum punya.
 *
 * Persona STAFF sudah ada di enum sejak `add_persona_to_roles`, tetapi tidak ada
 * satu pun role bawaan yang memakainya dan bisa membuka aplikasi mobile: ADMIN
 * dan FINANCE memang berpersona STAFF namun `accessEmployeePanel: false`, dan
 * satu-satunya persona STAFF yang bisa masuk adalah SUPER_ADMIN. Akibatnya
 * karyawan kantor biasa terpaksa diberi role TEKNISI — lalu melihat work order,
 * barang, dan topologi yang bukan urusannya.
 *
 * `prisma/seed.ts` sudah menambahkan role ini, tetapi seed hanya berjalan di
 * dev/CI (ekstensi Prisma menolak `IS_SEEDING` di production), jadi lingkungan
 * yang sudah berjalan butuh skrip ini.
 *
 * Jalankan dengan `--apply` untuk benar-benar menulis; tanpa flag itu skrip
 * hanya melaporkan apa yang akan dibuat atau diubah.
 *
 *   npx tsx scripts/tambah-role-staff.ts
 *   npx tsx scripts/tambah-role-staff.ts --apply
 *
 * Idempoten: role yang sudah ada hanya diselaraskan persona, akses panel, dan
 * izin mobile-nya. Tidak ada user yang dipindahkan ke role ini — penugasan
 * pengguna tetap keputusan admin tiap tenant.
 */

import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { runAsSystemContext } from "../lib/tenant-context";

const NAMA_ROLE_STAFF = "STAFF";

/** Sejajar dengan `RESOURCE_MOBILE_STAFF` di seed dan template "Staff Kantor". */
const RESOURCE_MOBILE_STAFF = [
  "m_dashboard",
  "m_absensi",
  "m_lembur",
  "m_izin",
  "m_holidays",
  "m_chat",
];

interface RingkasanTenant {
  tenantId: string | null;
  jumlahIzin: number;
  isBaru: boolean;
}

async function main() {
  const apply = process.argv.includes("--apply");

  // Skrip berjalan lintas tenant, jadi harus eksplisit minta konteks sistem.
  await runAsSystemContext("tambah role STAFF per tenant", () =>
    jalankan(apply),
  );
}

/** Tenant yang perlu punya role STAFF: setiap tenant yang sudah punya role. */
async function idTenantBerRole(): Promise<(string | null)[]> {
  const baris = await prisma.role.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
  });
  return baris.map((item) => item.tenantId);
}

async function jalankan(apply: boolean) {
  const daftarTenant = await idTenantBerRole();
  if (daftarTenant.length === 0) {
    logger.info("Tidak ada role sama sekali; tidak ada yang perlu dikerjakan.");
    return;
  }

  const ringkasan: RingkasanTenant[] = [];

  for (const tenantId of daftarTenant) {
    const izin = await prisma.permission.findMany({
      where: { tenantId, resource: { in: RESOURCE_MOBILE_STAFF } },
      select: { id: true, resource: true },
    });

    if (izin.length === 0) {
      logger.warn(
        `tenant ${tenantId ?? "-"}: tidak ada permission mobile sama sekali; dilewati`,
      );
      continue;
    }

    const adaSebelumnya = await prisma.role.findFirst({
      where: { name: NAMA_ROLE_STAFF, tenantId },
      select: { id: true },
    });

    ringkasan.push({
      tenantId,
      jumlahIzin: izin.length,
      isBaru: adaSebelumnya === null,
    });

    const resourceUnik = [...new Set(izin.map((item) => item.resource))].sort();
    logger.info(
      `[${apply ? "TULIS" : "RENCANA"}] tenant ${tenantId ?? "-"}: ${
        adaSebelumnya ? "selaraskan" : "buat"
      } role ${NAMA_ROLE_STAFF} — ${izin.length} baris izin (${resourceUnik.join(", ")})`,
    );

    if (!apply) continue;

    if (adaSebelumnya) {
      await prisma.role.update({
        where: { id: adaSebelumnya.id },
        data: {
          persona: "STAFF",
          accessAdminPanel: false,
          accessEmployeePanel: true,
          permission: { set: izin.map((item) => ({ id: item.id })) },
        },
      });
      continue;
    }

    await prisma.role.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: NAMA_ROLE_STAFF,
        tenantId,
        description: "Staff Kantor - Employee Portal Access (tanpa work order)",
        persona: "STAFF",
        accessAdminPanel: false,
        accessEmployeePanel: true,
        permission: { connect: izin.map((item) => ({ id: item.id })) },
      },
    });
  }

  const dibuat = ringkasan.filter((item) => item.isBaru).length;
  const diselaraskan = ringkasan.length - dibuat;
  logger.info(
    `Ringkasan: ${dibuat} role baru, ${diselaraskan} diselaraskan, dari ${daftarTenant.length} tenant.`,
  );

  if (!apply) {
    logger.info("Mode kering. Tambahkan --apply untuk benar-benar menulis.");
    return;
  }

  logger.info(
    "Selesai. Pengguna yang dipindahkan ke role ini harus login ulang — daftar fitur ikut di token sesi.",
  );
}

main()
  .catch((error) => {
    logger.error("Gagal menambah role STAFF:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
