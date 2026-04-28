import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import "dotenv/config";
import { logger } from "../lib/logger";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  logger.info("🌱 Seeding customer...");

  // 1. Get or create Site
  let site = await prisma.sites.findFirst();
  if (!site) {
    site = await prisma.sites.create({
      data: {
        id: randomUUID(),
        code: "SITE01",
        name: "Default Site",
        updatedAt: new Date(),
      },
    });
    logger.info("Created Site:", site.name);
  }

  // 2. Get or create ProfilePPP
  let profile = await prisma.profilePPP.findFirst();
  if (!profile) {
    profile = await prisma.profilePPP.create({
      data: {
        id: randomUUID(),
        name: "Default Profile",
        localAddress: "192.168.1.1",
        remoteAddress: "pool1",
        status: "AKTIF",
        updatedAt: new Date(),
      },
    });
    logger.info("Created ProfilePPP:", profile.name);
  }

  // 3. Get or create HargaPaket
  let hargaPaket = await prisma.hargaPaket.findFirst();
  if (!hargaPaket) {
    hargaPaket = await prisma.hargaPaket.create({
      data: {
        id: randomUUID(),
        name: "Package 10Mbps",
        harga: 150000,
        durasi: 30,
        durasiUnit: "HARI",
        profilePPPId: profile.id,
        status: "AKTIF",
        updatedAt: new Date(),
      },
    });
    logger.info("Created HargaPaket:", hargaPaket.name);
  }

  const idPelanggan = "88888888";
  const plainPassword = "customer123";
  const passwordHash = await hash(plainPassword, 12);

  // 4. Upsert Pelanggan
  let pelanggan = await prisma.pelanggan.findFirst({
    where: { idPelanggan },
  });

  if (pelanggan) {
    pelanggan = await prisma.pelanggan.update({
      where: { id: pelanggan.id },
      data: {
        passwordHash: passwordHash,
        status: "AKTIF",
      },
    });
  } else {
    pelanggan = await prisma.pelanggan.create({
      data: {
        id: randomUUID(),
        idPelanggan,
        nama: "Test Customer",
        username: "testcustomer",
        password: plainPassword, // This is often used for PPP password
        passwordHash: passwordHash,
        hargaPaketId: hargaPaket.id,
        siteId: site.id,
        status: "AKTIF",
        tanggalAktif: new Date(),
        jatuhTempo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });
  }

  logger.info("✅ Pelanggan seeded:", pelanggan.idPelanggan);
}

main()
  .catch((e) => {
    logger.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
