import { randomUUID } from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Persetujuan transfer, callback, dan cek status menyimpan PAID lebih dulu,
 * lalu menjalankan pelunasan. Pelunasan yang gagal di tengah (database
 * terputus, proses mati) dulu tidak diulang siapa pun: admin yang mengulang
 * persetujuan dijawab "sudah diproses", dan cek status serta penyapu hanya
 * menanyakan payment yang masih menunggu. Rekonsiliasi 15 menit kini
 * mengulangnya. Diuji terhadap Postgres sungguhan (netmanager_test +
 * billing_test); yang di-mock hanya event bus, antrean schedule, dan kunci.
 */

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: vi.fn(async () => undefined),
    onInvoicePartiallyPaid: vi.fn(async () => undefined),
    onPaymentOverpaid: vi.fn(async () => undefined),
    onPaymentRedirected: vi.fn(async () => undefined),
    onPaymentRejected: vi.fn(async () => undefined),
  },
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
}));

import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { BillingEventDispatcher } from "@/modules/events";
import { InvoicePaymentStateService } from "@/modules/finance/services/InvoicePaymentStateService";
import { ManualPaymentAdminRouteService } from "@/modules/finance/services/ManualPaymentAdminRouteService";
import { retryInterruptedSettlements } from "@/modules/finance/services/settlement-retry";

const hasTestDb = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = hasTestDb ? describe : describe.skip;

const TENANT = "tenant-ulang-lunas";
const PROFIL = "profil-ulang-lunas";
const PAKET = "paket-ulang-lunas";
const PELANGGAN = "pel-ulang-lunas";
const PRICE = 100000n;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// 11 Nov 2026 00:00 WIB.
const DUE = new Date("2026-11-10T17:00:00.000Z");

const dispatcher = vi.mocked(BillingEventDispatcher);

// Pelunasan ulang berjalan lintas tenant di database uji bersama; yang
// dihitung hanya event untuk tagihan tes ini.
const eventsFor = (
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  invoiceId: string,
) =>
  calls.filter(([first]) =>
    typeof first === "string"
      ? first === invoiceId
      : (first as { invoiceId?: string }).invoiceId === invoiceId,
  ).length;

const ago = (ms: number) => new Date(Date.now() - ms);

async function cleanup() {
  await prismaBillingAuth.payment.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({ where: { id: PAKET } });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
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
      remoteAddress: "pool-ulang-lunas",
      tenantId: TENANT,
      updatedAt: now,
    },
  });
  await prismaAuth.hargaPaket.create({
    data: {
      id: PAKET,
      name: PAKET,
      profilePPPId: PROFIL,
      harga: Number(PRICE),
      usePPN: false,
      tenantId: TENANT,
      updatedAt: now,
    },
  });
  await prismaAuth.pelanggan.create({
    data: {
      id: PELANGGAN,
      idPelanggan: "99990084",
      nama: "Pelanggan Uji Pelunasan Ulang",
      username: "ulang-lunas",
      password: "pppoe-ulang-lunas",
      hargaPaketId: PAKET,
      tanggalAktif: new Date("2026-09-11T00:00:00+07:00"),
      jatuhTempo: DUE,
      status: "ISOLIR",
      tenantId: TENANT,
      updatedAt: now,
    },
  });
}

function createInvoice(
  invoiceNumber: string,
  options: {
    status?: "SENT" | "PAID" | "CANCELLED";
    paidAmount?: bigint;
  } = {},
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
      paidAt: options.status === "PAID" ? ago(2 * HOUR_MS) : null,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/**
 * Payment yang sudah ditandai PAID oleh callback, cek status, atau
 * persetujuan, tanpa pelunasan sesudahnya (seperti proses yang mati di sana).
 */
function createPaidPayment(
  invoiceId: string,
  options: { amount?: bigint; discountAmount?: bigint; paidAt: Date },
) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount: options.amount ?? PRICE,
      discountAmount: options.discountAmount ?? 0n,
      checkoutId: randomUUID(),
      paymentDate: options.paidAt,
      paymentMethod: "BANK_TRANSFER",
      reference: `PAY-${randomUUID()}`,
      gatewayStatus: "PAID",
      gatewayProvider: "BC",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

function createManualTransferWithProof(invoiceId: string) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount: PRICE,
      checkoutId: randomUUID(),
      paymentDate: new Date(),
      paymentMethod: "BANK_TRANSFER",
      accountId: "rekening-ulang-lunas",
      reference: `PAY-${randomUUID()}`,
      gatewayStatus: "PENDING",
      receiptUrl: "/receipts/ulang-lunas.webp",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

const retry = () =>
  runAsSystemContext("tes: pelunasan ulang", () =>
    retryInterruptedSettlements(),
  );

const invoice = (id: string) =>
  prismaBillingAuth.invoice.findUniqueOrThrow({ where: { id } });

const payment = (id: string) =>
  prismaBillingAuth.payment.findUniqueOrThrow({ where: { id } });

async function saldoKredit() {
  const customer = await prismaAuth.pelanggan.findUniqueOrThrow({
    where: { id: PELANGGAN },
    select: { saldoKreditRupiah: true },
  });
  return customer.saldoKreditRupiah;
}

describeDb("pelunasan yang terhenti setelah payment PAID diulang", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanup();
    await seed();
  });

  afterAll(cleanup);

  it("persetujuan transfer yang pelunasannya gagal dilunasi ulang; INVOICE_PAID tetap sekali", async () => {
    const inv = await createInvoice("RTY-1");
    const manual = await createManualTransferWithProof(inv.id);
    const recompute = vi
      .spyOn(InvoicePaymentStateService.prototype, "recompute")
      .mockRejectedValueOnce(new Error("billing DB putus"));

    const approval = await runWithRequestTenantContext(
      { tenantId: TENANT, isSuperAdmin: false },
      () =>
        new ManualPaymentAdminRouteService().verifyManualPayment({
          paymentId: manual.id,
          action: "APPROVE",
        }),
    ).then(
      () => "disetujui",
      () => "gagal",
    );
    recompute.mockRestore();
    const stuck = {
      payment: (await payment(manual.id)).gatewayStatus,
      invoice: (await invoice(inv.id)).status,
    };
    // Jalur normal diberi 15 menit sebelum dianggap terhenti: persetujuannya
    // dimundurkan sejam alih-alih memajukan jam rekonsiliasi, yang akan ikut
    // menyapu baris segar tes lain di database bersama.
    await prismaBillingAuth.payment.update({
      where: { id: manual.id },
      data: { paymentDate: ago(HOUR_MS) },
    });

    await retry();
    await retry();

    const after = await invoice(inv.id);
    expect({
      approval,
      stuck,
      status: after.status,
      paidAmount: after.paidAmount,
      invoicePaidEvents: eventsFor(dispatcher.onInvoicePaid.mock.calls, inv.id),
    }).toEqual({
      approval: "gagal",
      stuck: { payment: "PAID", invoice: "SENT" },
      status: "PAID",
      paidAmount: PRICE,
      invoicePaidEvents: 1,
    });
  });

  it("VA yang lunas untuk tagihan yang sudah lunas: kelebihannya dikreditkan ke saldo sekali", async () => {
    const inv = await createInvoice("RTY-2", {
      status: "PAID",
      paidAmount: PRICE,
    });
    await createPaidPayment(inv.id, { paidAt: ago(2 * HOUR_MS) });
    const va = await createPaidPayment(inv.id, { paidAt: ago(HOUR_MS) });

    await retry();
    await retry();

    const after = await invoice(inv.id);
    expect({
      status: after.status,
      paidAmount: after.paidAmount,
      saldo: await saldoKredit(),
      credited: (await payment(va.id)).kelebihanBayar,
      invoicePaidEvents: eventsFor(dispatcher.onInvoicePaid.mock.calls, inv.id),
      overpaidNotices: eventsFor(
        dispatcher.onPaymentOverpaid.mock.calls,
        inv.id,
      ),
    }).toEqual({
      status: "PAID",
      paidAmount: 2n * PRICE,
      saldo: PRICE,
      credited: PRICE,
      invoicePaidEvents: 0,
      overpaidNotices: 1,
    });
  });

  // Payment Rp 0 tertutup kupon PAID sejak dibuat; tanpa potongannya tagihan
  // itu tidak terlihat tertinggal.
  it("potongan kupon ikut dihitung: tagihan yang tertutup kupon menjadi lunas", async () => {
    const inv = await createInvoice("RTY-3");
    await createPaidPayment(inv.id, {
      amount: 0n,
      discountAmount: PRICE,
      paidAt: ago(HOUR_MS),
    });

    await retry();

    const after = await invoice(inv.id);
    expect({ status: after.status, paidAmount: after.paidAmount }).toEqual({
      status: "PAID",
      paidAmount: PRICE,
    });
    expect(dispatcher.onInvoicePaid).toHaveBeenCalledWith(
      inv.id,
      PELANGGAN,
      Number(PRICE),
      { amountPaid: 0, couponDiscount: Number(PRICE), saldoUsed: 0 },
    );
  });

  it("pembayaran sebagian yang tertinggal menjadi PARTIAL_PAID dengan satu pemberitahuan", async () => {
    const inv = await createInvoice("RTY-4");
    await createPaidPayment(inv.id, { amount: 40000n, paidAt: ago(HOUR_MS) });

    await retry();
    await retry();

    const after = await invoice(inv.id);
    expect({
      status: after.status,
      paidAmount: after.paidAmount,
      partialNotices: eventsFor(
        dispatcher.onInvoicePartiallyPaid.mock.calls,
        inv.id,
      ),
    }).toEqual({
      status: "PARTIAL_PAID",
      paidAmount: 40000n,
      partialNotices: 1,
    });
  });

  it("tidak menyentuh tagihan yang sudah lunas, dibatalkan, di luar tiga hari, atau baru saja dibayar", async () => {
    const settled = await createInvoice("RTY-5A", {
      status: "PAID",
      paidAmount: PRICE,
    });
    await createPaidPayment(settled.id, { paidAt: ago(HOUR_MS) });
    const cancelled = await createInvoice("RTY-5B", { status: "CANCELLED" });
    await createPaidPayment(cancelled.id, { paidAt: ago(HOUR_MS) });
    const old = await createInvoice("RTY-5C");
    await createPaidPayment(old.id, { paidAt: ago(4 * DAY_MS) });
    const fresh = await createInvoice("RTY-5D");
    await createPaidPayment(fresh.id, { paidAt: ago(5 * MINUTE_MS) });

    await retry();

    const ours = [settled, cancelled, old, fresh];
    expect({
      statuses: await Promise.all(
        ours.map(async (inv) => (await invoice(inv.id)).status),
      ),
      saldo: await saldoKredit(),
      events: ours.map(
        (inv) =>
          eventsFor(dispatcher.onInvoicePaid.mock.calls, inv.id) +
          eventsFor(dispatcher.onInvoicePartiallyPaid.mock.calls, inv.id) +
          eventsFor(dispatcher.onPaymentOverpaid.mock.calls, inv.id) +
          eventsFor(dispatcher.onPaymentRedirected.mock.calls, inv.id),
      ),
    }).toEqual({
      statuses: ["PAID", "CANCELLED", "SENT", "SENT"],
      saldo: 0n,
      events: [0, 0, 0, 0],
    });
  });
});
