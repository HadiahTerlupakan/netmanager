import { randomUUID } from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Setiap jalan yang membatalkan atau menghapus tagihan menutup pilihan
 * "Transfer Manual" yang belum membawa bukti untuk tagihan itu, utuh per
 * checkout, dan mengembalikan kuponnya. Pelanggan tidak bisa lagi mengunggah
 * bukti untuk tagihan yang dibatalkan, jadi payment itu dulu tertinggal
 * menunggu tanpa jalan keluar dan memegang kuotanya. Yang sudah membawa bukti
 * tetap di antrean verifikasi admin.
 *
 * "Batalkan & Buat Tagihan Baru" diuji di payment-settlement.test.ts. Yang
 * di-mock hanya event bus, antrean schedule BullMQ, dan kunci Redis; invoice,
 * payment, kupon, dan pelanggan nyata (netmanager_test + billing_test).
 */

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: vi.fn(async () => undefined),
    onInvoicePartiallyPaid: vi.fn(async () => undefined),
    onPaymentOverpaid: vi.fn(async () => undefined),
    onPaymentFailed: vi.fn(async () => undefined),
    onPaymentRedirected: vi.fn(async () => undefined),
    onPaymentRejected: vi.fn(async () => undefined),
    onPaymentReviewRequired: vi.fn(async () => undefined),
    onPackageChanged: vi.fn(async () => undefined),
  },
  CustomerEventDispatcher: { onIsolated: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: vi.fn(async () => undefined) },
  EVENT_NAMES: new Proxy({} as Record<string, string>, {
    get: (_target, key) => (typeof key === "string" ? key : undefined),
  }),
  requirePayloadString: (value: unknown) => String(value),
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  syncInvoiceBillingSchedules: vi.fn(async () => undefined),
  cancelInvoiceBillingSchedules: vi.fn(async () => undefined),
}));
vi.mock("@/lib/distributed-lock", () => ({
  acquireLock: vi.fn(
    async (): Promise<() => Promise<void>> => async () => undefined,
  ),
}));
vi.mock("@/modules/notification", () => ({
  CUSTOMER_APP_BILLING_ROUTE: "/(customer)/tagihan",
  sendCustomerPushNotification: vi.fn(async () => undefined),
  notifyPackageUpgradeRequested: vi.fn(async () => undefined),
  notifyPackageUpgradeCancelled: vi.fn(async () => undefined),
}));

import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { CycleInvoiceRepriceService } from "@/modules/finance/services/CycleInvoiceRepriceService";
import {
  deleteInvoiceForRoute,
  updateInvoiceForRoute,
} from "@/modules/finance/services/InvoiceRouteService";
import { VoidInvoiceService } from "@/modules/finance/services/VoidInvoiceService";
import { createCustomerPaymentForRoute } from "@/modules/pelanggan/services/CustomerPaymentRouteService";

const hasTestDb = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = hasTestDb ? describe : describe.skip;

const TENANT = "tenant-batal-tf";
const PROFIL = "profil-batal-tf";
const PAKET = "paket-batal-tf";
const PAKET_BARU = "paket-batal-tf-baru";
const PELANGGAN = "pel-batal-tf";
const COUPON = "kupon-batal-tf";
const COUPON_CODE = "BATALTF10";
const MANUAL_METHOD = "MANUAL_rekening-batal-tf";
const ADMIN = { id: "admin-batal-tf", role: "SUPER_ADMIN" };
const PRICE = 100000n;
const NEW_PRICE = 150000n;
// 11 Nov 2026 00:00 WIB.
const DUE = new Date("2026-11-10T17:00:00.000Z");

function asTenant<T>(task: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    task,
  );
}

async function cleanup() {
  await prismaBillingAuth.payment.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaAuth.systemLog.deleteMany({
    where: { subject: { startsWith: "Invoice BTF-" } },
  });
  await prismaAuth.couponUsage.deleteMany({ where: { couponId: COUPON } });
  await prismaAuth.coupon.deleteMany({ where: { id: COUPON } });
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({
    where: { id: { in: [PAKET, PAKET_BARU] } },
  });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
}

function createPackage(id: string, harga: bigint) {
  return prismaAuth.hargaPaket.create({
    data: {
      id,
      name: id,
      profilePPPId: PROFIL,
      harga: Number(harga),
      usePPN: false,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

async function seed() {
  const now = new Date();
  await prismaAuth.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: TENANT },
  });
  await prismaAuth.profilePPP.create({
    data: {
      id: PROFIL,
      name: PROFIL,
      localAddress: "10.0.0.1",
      remoteAddress: "pool-batal-tf",
      tenantId: TENANT,
      updatedAt: now,
    },
  });
  await createPackage(PAKET, PRICE);
  await createPackage(PAKET_BARU, NEW_PRICE);
  await prismaAuth.pelanggan.create({
    data: {
      id: PELANGGAN,
      idPelanggan: "99990083",
      nama: "Pelanggan Uji Batal Transfer",
      username: "batal-tf",
      password: "pppoe-batal-tf",
      hargaPaketId: PAKET,
      tanggalAktif: new Date("2026-09-11T00:00:00+07:00"),
      jatuhTempo: DUE,
      status: "ISOLIR",
      usePPN: false,
      tenantId: TENANT,
      updatedAt: now,
    },
  });
  await prismaAuth.coupon.create({
    data: {
      id: COUPON,
      code: COUPON_CODE,
      discountType: "FIXED",
      discountValue: 10000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      quota: 1,
      usedCount: 0,
      tenantId: TENANT,
    },
  });
}

function createInvoice(
  invoiceNumber: string,
  options: { status?: "SENT" | "PARTIAL_PAID"; paidAmount?: bigint } = {},
) {
  return prismaBillingAuth.invoice.create({
    data: {
      id: randomUUID(),
      invoiceNumber,
      pelangganId: PELANGGAN,
      issueDate: new Date("2026-10-28T03:00:00.000Z"),
      dueDate: DUE,
      status: options.status ?? "SENT",
      subtotal: PRICE,
      totalAmount: PRICE,
      paidAmount: options.paidAmount ?? 0n,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Pembayaran yang sudah diterima kasir untuk sebagian tagihan. */
function createCashierPayment(invoiceId: string, amount: bigint) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount,
      paymentDate: new Date(),
      paymentMethod: "CASH",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Checkout transfer manual ke rekening perusahaan untuk satu tagihan. */
function createManualTransfer(
  invoiceId: string,
  options: { amount?: bigint; receiptUrl?: string } = {},
) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount: options.amount ?? PRICE,
      checkoutId: randomUUID(),
      paymentDate: new Date(),
      paymentMethod: "BANK_TRANSFER",
      accountId: "rekening-batal-tf",
      reference: `PAY-${randomUUID()}`,
      gatewayStatus: "PENDING",
      receiptUrl: options.receiptUrl ?? null,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Transfer manual yang dipilih pelanggan di portal dengan kupon. */
async function chooseManualTransferWithCoupon(invoiceId: string) {
  await asTenant(() =>
    createCustomerPaymentForRoute({
      customerId: PELANGGAN,
      tenantId: TENANT,
      invoiceIds: [invoiceId],
      paymentMethod: MANUAL_METHOD,
      couponCode: COUPON_CODE,
    }),
  );
  return prismaBillingAuth.payment.findFirstOrThrow({
    where: { invoiceId, gatewayStatus: "PENDING" },
  });
}

const paymentStatus = async (id: string) =>
  (await prismaBillingAuth.payment.findUniqueOrThrow({ where: { id } }))
    .gatewayStatus;

const invoiceStatus = async (id: string) =>
  (await prismaBillingAuth.invoice.findUniqueOrThrow({ where: { id } })).status;

async function couponUsedCount() {
  const coupon = await prismaAuth.coupon.findUniqueOrThrow({
    where: { id: COUPON },
  });
  return coupon.usedCount;
}

describeDb(
  "tagihan yang dibatalkan menutup Transfer Manual tanpa bukti",
  () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await cleanup();
      await seed();
    });

    afterAll(cleanup);

    it("membatalkan tagihan PARTIAL_PAID (void admin) menutup transfer tanpa bukti; yang berbukti tetap menunggu", async () => {
      const inv = await createInvoice("BTF-1", {
        status: "PARTIAL_PAID",
        paidAmount: 50000n,
      });
      await createCashierPayment(inv.id, 50000n);
      const abandoned = await createManualTransfer(inv.id, { amount: 50000n });
      const withProof = await createManualTransfer(inv.id, {
        amount: 50000n,
        receiptUrl: "/receipts/batal-tf.webp",
      });

      await asTenant(() =>
        VoidInvoiceService.voidInvoice(inv.id, "Salah tagih", ADMIN.id),
      );

      expect({
        invoice: await invoiceStatus(inv.id),
        abandoned: await paymentStatus(abandoned.id),
        withProof: await paymentStatus(withProof.id),
      }).toEqual({
        invoice: "CANCELLED",
        abandoned: "CANCELLED",
        withProof: "PENDING",
      });
    });

    it("admin membatalkan tagihan lewat ubah tagihan: transfer tanpa bukti ditutup dan kuponnya kembali", async () => {
      const inv = await createInvoice("BTF-2");
      const manual = await chooseManualTransferWithCoupon(inv.id);
      const couponUsedBefore = await couponUsedCount();

      await asTenant(() =>
        updateInvoiceForRoute({
          invoiceId: inv.id,
          user: ADMIN,
          isRestricted: false,
          input: { status: "CANCELLED" },
        }),
      );

      expect({
        couponUsedBefore,
        invoice: await invoiceStatus(inv.id),
        manual: await paymentStatus(manual.id),
        couponUsedAfter: await couponUsedCount(),
      }).toEqual({
        couponUsedBefore: 1,
        invoice: "CANCELLED",
        manual: "CANCELLED",
        couponUsedAfter: 0,
      });
    });

    it("ubah tagihan tanpa membatalkannya tidak menyentuh transfer yang menunggu", async () => {
      const inv = await createInvoice("BTF-2B");
      const manual = await createManualTransfer(inv.id);

      await asTenant(() =>
        updateInvoiceForRoute({
          invoiceId: inv.id,
          user: ADMIN,
          isRestricted: false,
          input: { notes: "Diperpanjang seminggu" },
        }),
      );

      expect(await paymentStatus(manual.id)).toBe("PENDING");
    });

    // Payment.invoiceId dilepas (ON DELETE SET NULL) saat tagihannya dihapus,
    // jadi transfernya harus ditutup sebelum itu.
    it("menghapus tagihan menutup transfer tanpa bukti lebih dulu dan kuponnya kembali", async () => {
      const inv = await createInvoice("BTF-3");
      const manual = await chooseManualTransferWithCoupon(inv.id);

      await asTenant(() =>
        deleteInvoiceForRoute({
          invoiceId: inv.id,
          user: ADMIN,
          isRestricted: false,
        }),
      );

      const after = await prismaBillingAuth.payment.findUniqueOrThrow({
        where: { id: manual.id },
      });
      expect({
        invoiceDeleted:
          (await prismaBillingAuth.invoice.findUnique({
            where: { id: inv.id },
          })) === null,
        manual: after.gatewayStatus,
        couponUsedAfter: await couponUsedCount(),
      }).toEqual({
        invoiceDeleted: true,
        manual: "CANCELLED",
        couponUsedAfter: 0,
      });
    });

    it("[kontrol] hitung ulang paket siklus menutup transfer tanpa bukti tagihan lamanya", async () => {
      const inv = await createInvoice("BTF-4");
      const manual = await createManualTransfer(inv.id);
      await prismaAuth.pelanggan.update({
        where: { id: PELANGGAN },
        data: {
          pendingPackageId: PAKET_BARU,
          pendingPackageApplyAt: new Date(DUE.getTime() - 60 * 60 * 1000),
        },
      });

      const result = await new CycleInvoiceRepriceService().syncCycleInvoice({
        pelangganId: PELANGGAN,
        cycleDate: DUE,
        previousPackageId: PAKET,
        reason: "PACKAGE_CHANGED",
      });

      expect({
        result: result.status,
        oldInvoice: await invoiceStatus(inv.id),
        manual: await paymentStatus(manual.id),
      }).toEqual({
        result: "REPRICED",
        oldInvoice: "CANCELLED",
        manual: "CANCELLED",
      });
    });
  },
);
