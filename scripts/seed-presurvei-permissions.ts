import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { logger } from "../lib/logger";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not found");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  {
    resource: "presurvei",
    action: "read",
    description: "Lihat kegiatan & prospek presurvei",
  },
  {
    resource: "presurvei",
    action: "create",
    description: "Catat kegiatan & prospek presurvei",
  },
  {
    resource: "presurvei",
    action: "update",
    description: "Ubah kegiatan & prospek presurvei",
  },
  {
    resource: "presurvei",
    action: "delete",
    description: "Hapus data presurvei",
  },
  // Tidak ada `site_only` di bawah ini (termasuk iklan/target/laporan dan
  // m_presurvei): pembatasan per-site adalah pekerjaan Fase 3 dan belum
  // ditegakkan kode mana pun. Menyemainya membuat toggle "Batasi ke Site Sendiri"
  // di panel admin tampak aktif padahal tidak berefek.
  {
    resource: "presurvei_iklan",
    action: "read",
    description: "Lihat kampanye iklan presurvei",
  },
  {
    resource: "presurvei_iklan",
    action: "create",
    description: "Catat kampanye iklan presurvei",
  },
  {
    resource: "presurvei_iklan",
    action: "update",
    description: "Ubah kampanye iklan presurvei",
  },
  {
    resource: "presurvei_target",
    action: "read",
    description: "Lihat target sales presurvei",
  },
  {
    resource: "presurvei_target",
    action: "create",
    description: "Tetapkan target sales presurvei",
  },
  {
    resource: "presurvei_laporan",
    action: "read",
    description: "Lihat laporan pencapaian presurvei",
  },
  {
    resource: "m_presurvei",
    action: "read",
    description: "Akses menu Presurvei di mobile",
  },
  {
    resource: "m_presurvei",
    action: "create",
    description: "Catat presurvei lewat mobile",
  },
  {
    resource: "m_presurvei",
    action: "update",
    description: "Ubah prospek lewat mobile",
  },
];

// Role admin menerima seluruh permission presurvei; sales hanya permission
// mobile karena mereka tidak mengakses panel admin, dan tidak diberi hak hapus
// supaya tidak bisa menghilangkan data rekan setimnya.
const ROLE_ADMIN = ["Super Admin", "SUPER_ADMIN", "ADMIN", "Admin"];
const ROLE_SALES = ["SALES", "Sales", "Branch Manager", " Branch Manager"];
const PERMISSION_SALES = [
  "m_presurvei:read",
  "m_presurvei:create",
  "m_presurvei:update",
];

async function main() {
  logger.info("Seeding Presurvei permissions...");

  for (const perm of PERMISSIONS) {
    const exists = await prisma.permission.findFirst({
      where: { resource: perm.resource, action: perm.action },
    });

    if (!exists) {
      await prisma.permission.create({
        data: {
          id: crypto.randomUUID(),
          name: `${perm.resource}:${perm.action}`,
          ...perm,
          updatedAt: new Date(),
        },
      });
      logger.info(`Created permission: ${perm.resource}:${perm.action}`);
    }
  }

  const semuaPermission = await prisma.permission.findMany({
    where: {
      resource: {
        in: [
          "presurvei",
          "m_presurvei",
          "presurvei_iklan",
          "presurvei_target",
          "presurvei_laporan",
        ],
      },
    },
  });

  const permissionSales = semuaPermission.filter((p) =>
    PERMISSION_SALES.includes(p.name),
  );

  await assignKeRole(ROLE_ADMIN, semuaPermission);
  await assignKeRole(ROLE_SALES, permissionSales);

  logger.info("Done!");
}

/** Lampirkan sekumpulan permission ke setiap role yang namanya cocok. */
async function assignKeRole(
  namaRole: string[],
  permissions: { id: string }[],
): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { name: { in: namaRole } },
  });

  for (const role of roles) {
    await prisma.role.update({
      where: { id: role.id },
      data: { permission: { connect: permissions.map((p) => ({ id: p.id })) } },
    });
    logger.info(
      `Assigned ${permissions.length} permissions to role: ${role.name}`,
    );
  }
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
