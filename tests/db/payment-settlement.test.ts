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
  sendCustomerPushNotification: vi.fn(async () => undefined),
  notifyPackageUpgradeRequested: vi.fn(async () => undefined),
  notifyPackageUpgradeCancelled: vi.fn(async () => undefined),
}));

import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { encryptApiKey } from "@/lib/utils/encryption";
import { BillingEventDispatcher } from "@/modules/events";
import { AutomaticBillingService } from "@/modules/finance/services/AutomaticBillingService";
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
const CONFIG_ID = "cfg-settle-duitku";
const MERCHANT = "DSETTLE1";
const API_KEY = "settle-api-key-for-tests-only";
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

function invoicePaidEventsFor(labels: Record<string, string>) {
  return dispatcher.onInvoicePaid.mock.calls.map(
    ([invoiceId]) => labels[invoiceId] ?? invoiceId,
  );
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
  });
});
