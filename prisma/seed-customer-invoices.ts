/**
 * Seed tagihan dev untuk pelanggan test portal.
 *
 * Membuat satu tagihan terlambat, satu tagihan berjalan, dan satu tagihan
 * terbayar sebagian beserta pembayarannya — supaya portal pelanggan bisa diuji
 * dalam keadaan sedang ada tagihan.
 *
 * Why raw PrismaClient: `lib/prisma*.ts` memakai extension `withTenantIsolation`
 * yang butuh tenant context dari request; script CLI tidak punya konteks itu,
 * jadi `tenantId` diisi eksplisit seperti di `seed-customer.ts`.
 */
import { PrismaClient as PrismaApp } from "@prisma/client";
import { PrismaClient as PrismaBilling } from "@prisma/client-billing";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";
import "dotenv/config";
import { logger } from "../lib/logger";
import { MAIN_TENANT_ID } from "../lib/tenant-constants";

const DEV_INVOICE_PREFIX = "INV-DEV-";
const DEFAULT_ID_PELANGGAN = "88888888";
const MONTHLY_FEE = 150_000;
const PARTIAL_PAID_AMOUNT = 50_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type InvoiceSpec = {
  invoiceNumber: string;
  status: "OVERDUE" | "SENT" | "PARTIAL_PAID";
  description: string;
  issuedDaysAgo: number;
  dueInDays: number;
  paidAmount: number;
};

const INVOICE_SPECS: InvoiceSpec[] = [
  {
    invoiceNumber: `${DEV_INVOICE_PREFIX}0001`,
    status: "OVERDUE",
    description: "Langganan Internet — periode lalu (terlambat)",
    issuedDaysAgo: 45,
    dueInDays: -15,
    paidAmount: 0,
  },
  {
    invoiceNumber: `${DEV_INVOICE_PREFIX}0002`,
    status: "PARTIAL_PAID",
    description: "Langganan Internet — periode berjalan (dibayar sebagian)",
    issuedDaysAgo: 20,
    dueInDays: 3,
    paidAmount: PARTIAL_PAID_AMOUNT,
  },
  {
    invoiceNumber: `${DEV_INVOICE_PREFIX}0003`,
    status: "SENT",
    description: "Langganan Internet — periode bulan ini",
    issuedDaysAgo: 5,
    dueInDays: 10,
    paidAmount: 0,
  },
];

function createAppClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString });
  return {
    client: new PrismaApp({ adapter: new PrismaPg(pool) }),
    pool,
  };
}

function createBillingClient() {
  const connectionString = process.env.DATABASE_URL_BILLING;
  if (!connectionString) throw new Error("DATABASE_URL_BILLING is not set");
  const pool = new Pool({ connectionString });
  return {
    client: new PrismaBilling({ adapter: new PrismaPg(pool) }),
    pool,
  };
}

function shiftDays(days: number): Date {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY);
}

/** Ambil pelanggan target seed; gagal cepat kalau belum di-seed. */
async function findTargetCustomer(app: PrismaApp, idPelanggan: string) {
  const pelanggan = await app.pelanggan.findFirst({
    where: { idPelanggan },
    select: { id: true, idPelanggan: true, nama: true, siteId: true },
  });

  if (!pelanggan) {
    throw new Error(
      `Pelanggan ${idPelanggan} tidak ditemukan. Jalankan dulu: npx tsx prisma/seed-customer.ts`,
    );
  }

  return pelanggan;
}

/** Hapus tagihan dev lama milik pelanggan ini supaya seed idempotent. */
async function removeExistingDevInvoices(
  billing: PrismaBilling,
  pelangganId: string,
) {
  const scope = {
    pelangganId,
    invoiceNumber: { startsWith: DEV_INVOICE_PREFIX },
  };

  const staleInvoices = await billing.invoice.findMany({
    where: scope,
    select: { id: true },
  });

  if (staleInvoices.length === 0) return 0;

  const staleIds = staleInvoices.map((invoice) => invoice.id);
  await billing.payment.deleteMany({ where: { invoiceId: { in: staleIds } } });
  await billing.invoice.deleteMany({ where: { id: { in: staleIds } } });

  return staleIds.length;
}

/** Buat satu tagihan beserta item dan pembayaran parsialnya (jika ada). */
async function createDevInvoice(
  billing: PrismaBilling,
  spec: InvoiceSpec,
  customer: { id: string; siteId: string | null },
) {
  const invoiceId = randomUUID();
  const issueDate = shiftDays(-spec.issuedDaysAgo);
  const now = new Date();

  await billing.invoice.create({
    data: {
      id: invoiceId,
      invoiceNumber: spec.invoiceNumber,
      pelangganId: customer.id,
      siteId: customer.siteId,
      tenantId: MAIN_TENANT_ID,
      issueDate,
      dueDate: shiftDays(spec.dueInDays),
      status: spec.status,
      subtotal: BigInt(MONTHLY_FEE),
      totalAmount: BigInt(MONTHLY_FEE),
      paidAmount: BigInt(spec.paidAmount),
      sentAt: issueDate,
      updatedAt: now,
      invoiceItem: {
        create: {
          id: randomUUID(),
          tenantId: MAIN_TENANT_ID,
          description: spec.description,
          quantity: 1,
          unitPrice: BigInt(MONTHLY_FEE),
          totalPrice: BigInt(MONTHLY_FEE),
          itemType: "MONTHLY_FEE",
        },
      },
    },
  });

  if (spec.paidAmount > 0) {
    await billing.payment.create({
      data: {
        id: randomUUID(),
        invoiceId,
        pelangganId: customer.id,
        tenantId: MAIN_TENANT_ID,
        amount: BigInt(spec.paidAmount),
        paymentDate: shiftDays(-spec.issuedDaysAgo + 1),
        paymentMethod: "BANK_TRANSFER",
        reference: `${spec.invoiceNumber}-PART`,
        notes: "Pembayaran sebagian (data dev)",
        updatedAt: now,
      },
    });
  }
}

async function main() {
  const idPelanggan = process.env.SEED_ID_PELANGGAN ?? DEFAULT_ID_PELANGGAN;
  const app = createAppClient();
  const billing = createBillingClient();

  try {
    logger.info("🌱 Seeding tagihan dev untuk pelanggan:", idPelanggan);

    const customer = await findTargetCustomer(app.client, idPelanggan);
    const removedCount = await removeExistingDevInvoices(
      billing.client,
      customer.id,
    );
    if (removedCount > 0) {
      logger.info(`Menghapus ${removedCount} tagihan dev lama`);
    }

    for (const spec of INVOICE_SPECS) {
      await createDevInvoice(billing.client, spec, customer);
      logger.info(`  • ${spec.invoiceNumber} (${spec.status})`);
    }

    const outstanding = INVOICE_SPECS.reduce(
      (total, spec) => total + MONTHLY_FEE - spec.paidAmount,
      0,
    );
    logger.info(
      `✅ ${INVOICE_SPECS.length} tagihan dibuat untuk ${customer.nama}. Total tunggakan: Rp ${outstanding.toLocaleString("id-ID")}`,
    );
  } finally {
    await app.client.$disconnect();
    await billing.client.$disconnect();
    await app.pool.end();
    await billing.pool.end();
  }
}

main().catch((error) => {
  logger.error("❌ Seed tagihan gagal:", error);
  process.exit(1);
});
