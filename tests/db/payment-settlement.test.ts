import { createHmac, randomUUID } from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pelunasan pembayaran pelanggan terhadap Postgres sungguhan (netmanager_test
 * + billing_test): webhook Duitku, persetujuan/penolakan transfer manual,
 * "Batalkan & Buat Tagihan Baru", dan tagihan yang tertutup saldo kredit.
 *
 * Sebagian kasus berasal dari probe audit 2026-10-31 (main 465cfb9d9) dan
 * gagal di sana; kasus "[kontrol]" mendokumentasikan perilaku yang sudah
 * benar. Yang di-mock hanya HTTP keluar (tidak ada panggilan yang sampai ke
 * Duitku), event bus, antrean schedule BullMQ, dan kunci Redis. Baris invoice,
 * payment, webhook event, kupon, saldo, dan konfigurasi gateway nyata.
 */

const http = vi.hoisted(() => ({
  fetch: vi.fn(),
  paidOrders: new Set<string>(),
}));

vi.mock(
  "@/modules/payment-gateway/services/providers/fetch-with-timeout",
  () => ({ fetchWithTimeout: http.fetch }),
);
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

import type { Job } from "bullmq";
import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { encryptApiKey } from "@/lib/utils/encryption";
import type { EventJobData } from "@/lib/event-bus/queues";
import { BillingEventDispatcher } from "@/modules/events";
import { AutomaticBillingService } from "@/modules/finance/services/AutomaticBillingService";
import { findRepriceBlocker } from "@/modules/finance/services/cycle-invoice-reprice";
import { handleInvoicePaidManualPaymentCleanup } from "@/modules/finance/services/event-handlers/invoice-paid-manual-cleanup.handler";
import { ManualPaymentAdminRouteService } from "@/modules/finance/services/ManualPaymentAdminRouteService";
import { WebhookProcessingService } from "@/modules/payment-gateway/services/webhook-processing-service";
import { createCustomerPaymentForRoute } from "@/modules/pelanggan/services/CustomerPaymentRouteService";

const hasTestDb = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = hasTestDb ? describe : describe.skip;

const TENANT = "tenant-settle-fix";
const PROFIL = "profil-settle-fix";
const PAKET = "paket-settle-fix";
const PELANGGAN = "pel-settle-fix";
const COUPON = "kupon-settle-fix";
const COUPON_CODE = "SETTLEFIX10";
const CONFIG_ID = "cfg-settle-duitku";
const MERCHANT = "DSETTLE1";
const API_KEY = "settle-api-key-for-tests-only";
const MANUAL_METHOD = "MANUAL_rekening-settle";
const PRICE = 100000n;
// 11 Nov 2026 00:00 WIB.
const DUE = new Date("2026-11-10T17:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

const dispatcher = vi.mocked(BillingEventDispatcher);

function jsonResponse(body: unknown) {
  return { status: 200, text: async () => JSON.stringify(body) };
}

/** Duitku palsu: inquiry berhasil; transactionStatus PAID hanya untuk `paidOrders`. */
function fakeDuitku(url: string, init: { body: string }) {
  const body = JSON.parse(init.body) as { merchantOrderId: string };
  if (url.endsWith("/merchant/v2/inquiry")) {
    return jsonResponse({
      statusCode: "00",
      statusMessage: "SUCCESS",
      reference: `DREF-${body.merchantOrderId}`,
      vaNumber: "7007014000000001",
      qrString: "00020101021226610016ID.CO.SHOPEE.WWW",
      paymentUrl: "https://sandbox.duitku.com/settle",
    });
  }
  if (url.endsWith("/merchant/transactionStatus")) {
    return jsonResponse(
      http.paidOrders.has(body.merchantOrderId)
        ? {
            merchantOrderId: body.merchantOrderId,
            reference: `DREF-${body.merchantOrderId}`,
            amount: "100000",
            fee: "0",
            statusCode: "00",
            statusMessage: "SUCCESS",
          }
        : { merchantOrderId: body.merchantOrderId, statusCode: "01" },
    );
  }
  throw new Error(`[settle] unexpected outbound call to ${url}`);
}

function asTenant<T>(task: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    task,
  );
}

async function cleanup() {
  const payments = await prismaBillingAuth.payment.findMany({
    where: { pelangganId: PELANGGAN },
    select: { reference: true },
  });
  const references = payments.flatMap((p) =>
    p.reference ? [p.reference] : [],
  );
  await prismaBillingAuth.webhookEvent.deleteMany({
    where: { orderId: { in: references } },
  });
  await prismaBillingAuth.payment.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaBillingAuth.paymentGatewayConfig.deleteMany({
    where: { id: CONFIG_ID },
  });
  await prismaAuth.couponUsage.deleteMany({ where: { couponId: COUPON } });
  await prismaAuth.coupon.deleteMany({ where: { id: COUPON } });
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({ where: { id: PAKET } });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
}

async function seed(options: { saldo?: bigint } = {}) {
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
      remoteAddress: "pool-settle",
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
      idPelanggan: "99990082",
      nama: "Pelanggan Uji Pelunasan",
      username: "settle-fix",
      password: "pppoe-settle",
      hargaPaketId: PAKET,
      tanggalAktif: new Date("2026-09-11T00:00:00+07:00"),
      jatuhTempo: DUE,
      status: "ISOLIR",
      saldoKreditRupiah: options.saldo ?? 0n,
      // Tanpa PPN: tagihan pengganti bernominal sama dengan paketnya.
      usePPN: false,
      tenantId: TENANT,
      updatedAt: now,
    },
  });
  await prismaBillingAuth.paymentGatewayConfig.create({
    data: {
      id: CONFIG_ID,
      provider: "DUITKU",
      providerName: "DUITKU",
      isEnabled: true,
      isProduction: false,
      priority: 0,
      apiKey: encryptApiKey(API_KEY),
      merchantId: MERCHANT,
      tenantId: TENANT,
      updatedAt: now,
    },
  });
}

function createInvoice(
  invoiceNumber: string,
  total: bigint,
  options: { issueDate?: Date; status?: "SENT" | "CANCELLED" } = {},
) {
  const now = new Date();
  return prismaBillingAuth.invoice.create({
    data: {
      id: randomUUID(),
      invoiceNumber,
      pelangganId: PELANGGAN,
      issueDate: options.issueDate ?? new Date("2026-10-28T03:00:00.000Z"),
      dueDate: DUE,
      status: options.status ?? "SENT",
      subtotal: total,
      totalAmount: total,
      tenantId: TENANT,
      updatedAt: now,
    },
  });
}

/** Checkout VA BCA seperti yang ditinggalkan portal setelah inquiry berhasil. */
function createVa(
  invoiceId: string,
  reference: string,
  options: { expiresAt?: Date; status?: "PENDING" | "EXPIRED" } = {},
) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: PELANGGAN,
      amount: PRICE,
      checkoutId: randomUUID(),
      paymentDate: new Date(),
      paymentMethod: "OTHER",
      reference,
      gatewayStatus: options.status ?? "PENDING",
      gatewayProvider: "BC",
      transactionId: `DREF-${reference}`,
      vaNumber: "7007014000000001",
      expiresAt: options.expiresAt ?? new Date(Date.now() + 23 * HOUR_MS),
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Callback Duitku bertanda tangan sesuai dokumentasi. */
function duitkuCallback(input: {
  merchantOrderId: string;
  amount: bigint;
  reference: string;
  paymentCode?: string;
}) {
  const amount = input.amount.toString();
  const signature = createHmac("sha256", API_KEY)
    .update(`${MERCHANT}${amount}${input.merchantOrderId}`)
    .digest("hex");
  const rawBody = new URLSearchParams({
    merchantCode: MERCHANT,
    amount,
    merchantOrderId: input.merchantOrderId,
    productDetail: "Pembayaran Tagihan NetManager",
    additionalParam: "",
    paymentCode: input.paymentCode ?? "BC",
    resultCode: "00",
    merchantUserId: "",
    reference: input.reference,
    signature,
    settlementDate: "2026-11-02",
  }).toString();
  return new WebhookProcessingService().process({
    providerType: "duitku",
    rawBody,
    headers: new Headers({
      "content-type": "application/x-www-form-urlencoded",
    }),
    tenantId: null,
  });
}

const payVa = (va: {
  reference: string | null;
  transactionId: string | null;
}) =>
  duitkuCallback({
    merchantOrderId: va.reference!,
    amount: PRICE,
    reference: va.transactionId!,
  });

const payFromPortal = (
  invoiceIds: string[],
  paymentMethod: string,
  couponCode?: string,
) =>
  asTenant(() =>
    createCustomerPaymentForRoute({
      customerId: PELANGGAN,
      tenantId: TENANT,
      invoiceIds,
      paymentMethod,
      couponCode,
    }),
  );

const voidAndCreateNew = () =>
  asTenant(() => AutomaticBillingService.replaceOutstandingInvoice(PELANGGAN));

const adminVerify = (
  paymentId: string,
  action: "APPROVE" | "REJECT",
  extra: { reason?: string; notes?: string } = {},
) =>
  asTenant(() =>
    new ManualPaymentAdminRouteService().verifyManualPayment({
      paymentId,
      action,
      ...extra,
    }),
  );

const invoice = (id: string) =>
  prismaBillingAuth.invoice.findUniqueOrThrow({ where: { id } });

const payment = (id: string) =>
  prismaBillingAuth.payment.findUniqueOrThrow({ where: { id } });

const invoices = () =>
  prismaBillingAuth.invoice.findMany({
    where: { pelangganId: PELANGGAN },
    orderBy: { createdAt: "asc" },
  });

async function saldoKredit() {
  const customer = await prismaAuth.pelanggan.findUniqueOrThrow({
    where: { id: PELANGGAN },
    select: { saldoKreditRupiah: true },
  });
  return customer.saldoKreditRupiah;
}

async function invoiceWithPayments(id: string) {
  return prismaBillingAuth.invoice.findUniqueOrThrow({
    where: { id },
    include: {
      payment: {
        select: { gatewayStatus: true, expiresAt: true, receiptUrl: true },
      },
    },
  });
}

/** Unggah bukti: seperti server, bukti menempel di semua payment checkout. */
async function attachProof(invoiceId: string) {
  const manual = await prismaBillingAuth.payment.findFirstOrThrow({
    where: {
      invoiceId,
      paymentMethod: "BANK_TRANSFER",
      gatewayStatus: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });
  await prismaBillingAuth.payment.updateMany({
    where: manual.checkoutId
      ? { checkoutId: manual.checkoutId }
      : { id: manual.id },
    data: { receiptUrl: "/receipts/settle-proof.webp" },
  });
  return manual;
}

function invoicePaidEventsFor(labels: Record<string, string>) {
  return dispatcher.onInvoicePaid.mock.calls.map(
    ([invoiceId]) => labels[invoiceId] ?? invoiceId,
  );
}

function invoicePaidJob(invoiceId: string): Job<EventJobData> {
  return {
    id: `job-${invoiceId}`,
    data: {
      eventName: "INVOICE_PAID",
      payload: { invoiceId, pelangganId: PELANGGAN },
    },
  } as unknown as Job<EventJobData>;
}

describeDb("pelunasan pembayaran pelanggan", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    http.paidOrders.clear();
    http.fetch.mockImplementation(async (url: string, init: { body: string }) =>
      fakeDuitku(url, init),
    );
    await cleanup();
  });

  afterAll(cleanup);

  it("[kontrol] callback Duitku ganda melunasi invoice tepat sekali", async () => {
    await seed();
    const inv = await createInvoice("STL-C1", PRICE);
    const va = await createVa(inv.id, "PAY-SETTLE-C1");

    const first = await payVa(va);
    const second = await payVa(va);
    const after = await invoice(inv.id);

    expect({
      first: first.status,
      second: second.body.message,
      status: after.status,
      paidAmount: after.paidAmount,
      invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
    }).toEqual({
      first: 200,
      second: "Already processed",
      status: "PAID",
      paidAmount: PRICE,
      invoicePaidEvents: 1,
    });
  });

  it("[kontrol] VA lama yang dibayar setelah QRIS pengganti menjadi saldo kredit", async () => {
    await seed();
    const inv = await createInvoice("STL-C2", PRICE);
    await payFromPortal([inv.id], "BC");
    await payFromPortal([inv.id], "SP");
    const va = await prismaBillingAuth.payment.findFirstOrThrow({
      where: { invoiceId: inv.id, gatewayProvider: "BC" },
    });
    const qris = await prismaBillingAuth.payment.findFirstOrThrow({
      where: { invoiceId: inv.id, gatewayProvider: "SP" },
    });

    await duitkuCallback({
      merchantOrderId: qris.reference!,
      amount: PRICE,
      reference: qris.transactionId!,
      paymentCode: "SP",
    });
    await payVa(va);

    expect({
      invoiceStatus: (await invoice(inv.id)).status,
      saldoKredit: await saldoKredit(),
      overpaidNotices: dispatcher.onPaymentOverpaid.mock.calls.length,
    }).toEqual({
      invoiceStatus: "PAID",
      saldoKredit: PRICE,
      overpaidNotices: 1,
    });
  });

  describe("Batalkan & Buat Tagihan Baru", () => {
    it("tidak membatalkan tagihan yang VA-nya masih bisa dibayar, dan memberi tahu admin", async () => {
      await seed();
      const inv1 = await createInvoice("STL-1", PRICE);
      await createVa(inv1.id, "PAY-SETTLE-T1");

      const repriceGuard = findRepriceBlocker(
        await invoiceWithPayments(inv1.id),
        new Date(),
      );
      const result = await voidAndCreateNew();

      expect({
        repriceGuard,
        oldInvoice: (await invoice(inv1.id)).status,
        liveInvoices: (await invoices()).filter((i) => i.status !== "CANCELLED")
          .length,
        replacementCreated: result.invoice !== null,
        kept: result.keptInvoices.map((k) => [k.invoiceNumber, k.reason]),
      }).toEqual({
        repriceGuard: "ACTIVE_CHECKOUT",
        oldInvoice: "SENT",
        liveInvoices: 1,
        replacementCreated: false,
        kept: [["STL-1", "ACTIVE_CHECKOUT"]],
      });
      expect(result.keptInvoices[0].message).toMatch(
        /STL-1 tidak dibatalkan karena pelanggan sedang membayar \(.+ aktif sampai .+ WIB\)/,
      );
    });

    it("tidak membatalkan tagihan yang bukti transfernya menunggu verifikasi", async () => {
      await seed();
      const inv1 = await createInvoice("STL-1B", PRICE);
      await payFromPortal([inv1.id], MANUAL_METHOD);
      await attachProof(inv1.id);

      const result = await voidAndCreateNew();

      expect({
        oldInvoice: (await invoice(inv1.id)).status,
        invoiceCount: (await invoices()).length,
        kept: result.keptInvoices.map((k) => k.reason),
      }).toEqual({
        oldInvoice: "SENT",
        invoiceCount: 1,
        kept: ["PAYMENT_RECORDED"],
      });
      expect(result.keptInvoices[0].message).toContain(
        "bukti transfer yang menunggu verifikasi",
      );
    });

    it("mengembalikan saldo kredit yang dipakai tagihan yang dibatalkan", async () => {
      await seed({ saldo: 50000n });
      await asTenant(() =>
        AutomaticBillingService.generateImmediateInvoice(PELANGGAN),
      );
      const [first] = await invoices();
      const saldoAfterFirstInvoice = await saldoKredit();

      await voidAndCreateNew();
      const replacement = (await invoices()).find((i) => i.id !== first.id)!;

      expect({
        creditUsedByFirstInvoice: first.discountAmount,
        saldoAfterFirstInvoice,
        firstInvoiceStatus: (await invoice(first.id)).status,
        creditStillWorkingForCustomer:
          (await saldoKredit()) + replacement.discountAmount,
      }).toEqual({
        creditUsedByFirstInvoice: 50000n,
        saldoAfterFirstInvoice: 0n,
        firstInvoiceStatus: "CANCELLED",
        creditStillWorkingForCustomer: 50000n,
      });
    });
  });

  describe("uang untuk tagihan yang sudah dibatalkan", () => {
    it("callback VA yang telat setelah tagihannya diganti melunasi tagihan pengganti", async () => {
      await seed();
      const inv1 = await createInvoice("STL-2", PRICE);
      // Penyapu sudah menutupnya, tetapi Duitku masih mengirim callback.
      const va = await createVa(inv1.id, "PAY-SETTLE-T2", {
        expiresAt: new Date(Date.now() - 2 * HOUR_MS),
        status: "EXPIRED",
      });
      await voidAndCreateNew();
      const replacement = (await invoices()).find((i) => i.id !== inv1.id)!;

      const callback = await payVa(va);

      const after = await invoice(replacement.id);
      expect({
        callbackHttp: callback.status,
        cancelledInvoice: (await invoice(inv1.id)).status,
        replacementStatus: after.status,
        replacementPaid: after.paidAmount,
        saldo: await saldoKredit(),
        paymentNowOn: (await payment(va.id)).invoiceId,
        invoicePaidFor: invoicePaidEventsFor({
          [inv1.id]: "dibatalkan",
          [replacement.id]: "pengganti",
        }),
      }).toEqual({
        callbackHttp: 200,
        cancelledInvoice: "CANCELLED",
        replacementStatus: "PAID",
        replacementPaid: PRICE,
        saldo: 0n,
        paymentNowOn: replacement.id,
        invoicePaidFor: ["pengganti"],
      });
      expect(dispatcher.onPaymentRedirected).toHaveBeenCalledTimes(1);
      expect(dispatcher.onPaymentRedirected).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: inv1.id,
          pelangganId: PELANGGAN,
          cancelledInvoiceNumber: "STL-2",
          replacementInvoiceNumber: replacement.invoiceNumber,
          amount: Number(PRICE),
          appliedAmount: Number(PRICE),
          creditedAmount: 0,
        }),
      );
      expect(dispatcher.onPaymentOverpaid).not.toHaveBeenCalled();
    });

    it("tanpa tagihan pengganti yang terbuka, seluruh uangnya menjadi saldo kredit", async () => {
      await seed();
      const inv1 = await createInvoice("STL-3", PRICE);
      const va = await createVa(inv1.id, "PAY-SETTLE-T3", {
        expiresAt: new Date(Date.now() - 2 * HOUR_MS),
        status: "EXPIRED",
      });
      await voidAndCreateNew();
      const replacement = (await invoices()).find((i) => i.id !== inv1.id)!;
      // Pelanggan sudah melunasi tagihan pengganti lewat jalur lain.
      await prismaBillingAuth.invoice.update({
        where: { id: replacement.id },
        data: { status: "PAID", paidAmount: PRICE, paidAt: new Date() },
      });

      await payVa(va);
      await payVa(va);

      expect({
        cancelledInvoice: (await invoice(inv1.id)).status,
        cancelledPaidAmount: (await invoice(inv1.id)).paidAmount,
        saldo: await saldoKredit(),
        credited: (await payment(va.id)).kelebihanBayar,
        invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
      }).toEqual({
        cancelledInvoice: "CANCELLED",
        cancelledPaidAmount: 0n,
        saldo: PRICE,
        credited: PRICE,
        invoicePaidEvents: 0,
      });
      expect(dispatcher.onPaymentRedirected).toHaveBeenCalledTimes(1);
      expect(dispatcher.onPaymentRedirected).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelledInvoiceNumber: "STL-3",
          replacementInvoiceNumber: undefined,
          appliedAmount: 0,
          creditedAmount: Number(PRICE),
        }),
      );
    });

    it("melunasi sisa tagihan pengganti dulu, kelebihannya menjadi saldo kredit", async () => {
      await seed();
      const inv1 = await createInvoice("STL-4", PRICE);
      const va = await createVa(inv1.id, "PAY-SETTLE-T4", {
        expiresAt: new Date(Date.now() - 2 * HOUR_MS),
        status: "EXPIRED",
      });
      // Seperti reprice turun paket: dibatalkan lalu diganti tagihan lebih murah.
      await prismaBillingAuth.invoice.update({
        where: { id: inv1.id },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
      const replacement = await createInvoice("STL-4R", 60000n);

      await payVa(va);

      expect({
        replacementStatus: (await invoice(replacement.id)).status,
        saldo: await saldoKredit(),
        cancelledInvoice: (await invoice(inv1.id)).status,
      }).toEqual({
        replacementStatus: "PAID",
        saldo: 40000n,
        cancelledInvoice: "CANCELLED",
      });
      expect(dispatcher.onPaymentRedirected).toHaveBeenCalledWith(
        expect.objectContaining({
          replacementInvoiceNumber: "STL-4R",
          appliedAmount: 60000,
          creditedAmount: 40000,
        }),
      );
      expect(dispatcher.onPaymentOverpaid).not.toHaveBeenCalled();
    });
    it("bukti transfer yang disetujui setelah tagihannya diganti melunasi tagihan pengganti", async () => {
      await seed();
      const inv1 = await createInvoice("STL-5", PRICE);
      await payFromPortal([inv1.id], MANUAL_METHOD);
      // Belum ada bukti saat admin mengganti tagihan; bukti menyusul.
      await voidAndCreateNew();
      const statusAfterVoid = (await invoice(inv1.id)).status;
      const replacement = (await invoices()).find((i) => i.id !== inv1.id)!;
      const manual = await attachProof(inv1.id);

      const result = await adminVerify(manual.id, "APPROVE");

      const after = await invoice(replacement.id);
      expect({
        statusAfterVoid,
        cancelledInvoiceAfterApproval: (await invoice(inv1.id)).status,
        replacementStatus: after.status,
        moneyCreditedOrApplied: (await saldoKredit()) + after.paidAmount,
        invoicePaidFor: invoicePaidEventsFor({
          [inv1.id]: "dibatalkan",
          [replacement.id]: "pengganti",
        }),
      }).toEqual({
        statusAfterVoid: "CANCELLED",
        cancelledInvoiceAfterApproval: "CANCELLED",
        replacementStatus: "PAID",
        moneyCreditedOrApplied: PRICE,
        invoicePaidFor: ["pengganti"],
      });
      expect(result.warnings.join(" ")).toContain("STL-5");
    });
  });
  describe("verifikasi transfer manual", () => {
    it("bukti transfer untuk tagihan yang sudah lunas lewat Duitku dikreditkan ke saldo", async () => {
      await seed();
      const inv = await createInvoice("STL-6", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      const manual = await attachProof(inv.id);
      // Bosan menunggu, pelanggan membayar lewat QRIS.
      await payFromPortal([inv.id], "SP");
      const qris = await prismaBillingAuth.payment.findFirstOrThrow({
        where: { invoiceId: inv.id, gatewayProvider: "SP" },
      });
      await duitkuCallback({
        merchantOrderId: qris.reference!,
        amount: PRICE,
        reference: qris.transactionId!,
        paymentCode: "SP",
      });

      const queue = await asTenant(() =>
        new ManualPaymentAdminRouteService().getPendingManualPayments({
          status: "PENDING",
        }),
      );
      const result = await adminVerify(manual.id, "APPROVE");

      expect({
        flaggedBeforeApproval: queue.find((p) => p.id === manual.id)
          ?.settlementWarning,
        invoiceStatus: (await invoice(inv.id)).status,
        saldoKredit: await saldoKredit(),
        manualKelebihanBayar: (await payment(manual.id)).kelebihanBayar,
        overpaidNotifications: dispatcher.onPaymentOverpaid.mock.calls.length,
        invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
      }).toEqual({
        flaggedBeforeApproval:
          "Tagihan sudah lunas — menyetujui akan dikreditkan ke saldo",
        invoiceStatus: "PAID",
        saldoKredit: PRICE,
        manualKelebihanBayar: PRICE,
        overpaidNotifications: 1,
        invoicePaidEvents: 1,
      });
      expect(result.warnings.join(" ")).toContain("dikreditkan ke saldo");
    });

    it("menyetujui satu payment melunasi seluruh checkout transfer itu", async () => {
      await seed();
      const older = await createInvoice("STL-7A", PRICE, {
        issueDate: new Date("2026-10-01T03:00:00.000Z"),
      });
      const newer = await createInvoice("STL-7B", 50000n, {
        issueDate: new Date("2026-10-20T03:00:00.000Z"),
      });
      await payFromPortal([older.id, newer.id], MANUAL_METHOD);
      const manual = await attachProof(older.id);

      await adminVerify(manual.id, "APPROVE");

      const payments = await prismaBillingAuth.payment.findMany({
        where: { checkoutId: manual.checkoutId },
      });
      expect({
        olderStatus: (await invoice(older.id)).status,
        newerStatus: (await invoice(newer.id)).status,
        paymentStatuses: payments.map((p) => p.gatewayStatus),
      }).toEqual({
        olderStatus: "PAID",
        newerStatus: "PAID",
        paymentStatuses: ["PAID", "PAID"],
      });
    });

    it("checkout gateway tidak bisa disetujui sebagai transfer manual", async () => {
      await seed();
      const inv = await createInvoice("STL-8", PRICE);
      const va = await createVa(inv.id, "PAY-SETTLE-T8");

      const outcome = await adminVerify(va.id, "APPROVE").then(
        () => "approved",
        (error: Error) => error.message,
      );

      expect({
        outcome,
        vaStatus: (await payment(va.id)).gatewayStatus,
        invoiceStatus: (await invoice(inv.id)).status,
      }).toEqual({
        outcome: "Hanya transfer manual yang bisa diverifikasi di sini",
        vaStatus: "PENDING",
        invoiceStatus: "SENT",
      });
    });

    it("setuju dan tolak yang bersamaan hanya dimenangkan satu", async () => {
      await seed();
      const inv = await createInvoice("STL-9", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      const manual = await attachProof(inv.id);

      const outcomes = await Promise.allSettled([
        adminVerify(manual.id, "APPROVE"),
        adminVerify(manual.id, "REJECT", { reason: "Buram" }),
      ]);

      const after = await payment(manual.id);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      expect({
        payment: after.gatewayStatus,
        invoice: (await invoice(inv.id)).status,
        reason: after.rejectionReason,
      }).toEqual(
        after.gatewayStatus === "PAID"
          ? { payment: "PAID", invoice: "PAID", reason: null }
          : { payment: "FAILED", invoice: "SENT", reason: "Buram" },
      );
    });

    it("menolak bukti menyimpan alasannya tanpa menimpa catatan OCR dan memberi tahu pelanggan", async () => {
      await seed();
      const inv = await createInvoice("STL-10", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      const manual = await attachProof(inv.id);
      await prismaBillingAuth.payment.update({
        where: { id: manual.id },
        data: { notes: "✅ [AI] Nominal dan rekening cocok" },
      });

      await adminVerify(manual.id, "REJECT", {
        reason: "Nama pengirim tidak sesuai",
      });

      const after = await payment(manual.id);
      expect({
        status: after.gatewayStatus,
        rejectionReason: after.rejectionReason,
        notes: after.notes,
        invoiceStatus: (await invoice(inv.id)).status,
      }).toEqual({
        status: "FAILED",
        rejectionReason: "Nama pengirim tidak sesuai",
        notes: "✅ [AI] Nominal dan rekening cocok",
        invoiceStatus: "SENT",
      });
      expect(dispatcher.onPaymentRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: inv.id,
          pelangganId: PELANGGAN,
          amount: Number(PRICE),
          invoiceNumbers: ["STL-10"],
          reason: "Nama pengirim tidak sesuai",
          tenantId: TENANT,
        }),
      );
    });

    it("menolak bukti transfer mengembalikan kupon agar bisa dipakai lagi", async () => {
      await seed();
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
      const inv = await createInvoice("STL-11", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD, COUPON_CODE);
      const manual = await attachProof(inv.id);

      await adminVerify(manual.id, "REJECT");
      const usedCountAfterReject = (
        await prismaAuth.coupon.findUniqueOrThrow({ where: { id: COUPON } })
      ).usedCount;
      const retry = await payFromPortal(
        [inv.id],
        MANUAL_METHOD,
        COUPON_CODE,
      ).then(
        () => "accepted",
        (error: Error) => error.message,
      );

      expect({ usedCountAfterReject, retryWithSameCoupon: retry }).toEqual({
        usedCountAfterReject: 0,
        retryWithSameCoupon: "accepted",
      });
    });

    it("saat tagihan lunas, transfer manual tanpa bukti dibatalkan dan yang berbukti tetap ditandai", async () => {
      await seed();
      const inv = await createInvoice("STL-12", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      const abandoned = await prismaBillingAuth.payment.findFirstOrThrow({
        where: { invoiceId: inv.id, paymentMethod: "BANK_TRANSFER" },
      });
      await payFromPortal([inv.id], MANUAL_METHOD);
      const withProof = await attachProof(inv.id);
      await payFromPortal([inv.id], "SP");
      const qris = await prismaBillingAuth.payment.findFirstOrThrow({
        where: { invoiceId: inv.id, gatewayProvider: "SP" },
      });
      await duitkuCallback({
        merchantOrderId: qris.reference!,
        amount: PRICE,
        reference: qris.transactionId!,
        paymentCode: "SP",
      });

      await handleInvoicePaidManualPaymentCleanup(invoicePaidJob(inv.id));

      const queue = await asTenant(() =>
        new ManualPaymentAdminRouteService().getPendingManualPayments({
          status: "PENDING",
        }),
      );
      expect({
        abandoned: (await payment(abandoned.id)).gatewayStatus,
        withProof: (await payment(withProof.id)).gatewayStatus,
        queued: queue.map((p) => [p.id, p.settlementWarning]),
      }).toEqual({
        abandoned: "CANCELLED",
        withProof: "PENDING",
        queued: [
          [
            withProof.id,
            "Tagihan sudah lunas — menyetujui akan dikreditkan ke saldo",
          ],
        ],
      });
    });
  });

  it("transfer manual tanpa bukti tidak menahan hitung ulang tagihan; yang berbukti menahan", async () => {
    await seed();
    const inv = await createInvoice("STL-13", PRICE);

    await payFromPortal([inv.id], MANUAL_METHOD);
    const withoutProof = findRepriceBlocker(
      await invoiceWithPayments(inv.id),
      new Date(),
    );
    await attachProof(inv.id);
    const withProof = findRepriceBlocker(
      await invoiceWithPayments(inv.id),
      new Date(),
    );

    expect({ withoutProof, withProof }).toEqual({
      withoutProof: null,
      withProof: "PAYMENT_RECORDED",
    });
  });
});
