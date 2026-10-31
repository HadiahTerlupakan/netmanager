import { createHmac, randomUUID } from "crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pembayaran pelanggan lewat Duitku dan transfer manual terhadap Postgres
 * sungguhan (netmanager_test + billing_test), dari pembuatan checkout sampai
 * pelunasan. Sebagian besar kasus berasal dari audit pembayaran 2026-10-31.
 *
 * Hanya HTTP keluar (fetchWithTimeout: tidak ada panggilan yang sampai ke
 * Duitku), event bus, antrean jadwal tagihan, dan kunci Redis yang dipalsukan.
 * Invoice, payment, webhook event, kupon, saldo, dan konfigurasi gateway nyata.
 *
 * Id-nya sendiri (`gwfix`): database uji dipakai bersama tes lain.
 */

const http = vi.hoisted(() => ({
  fetch: vi.fn(),
  paidOrders: new Set<string>(),
  unreachable: false,
  rejectInquiry: false,
  /** Dijalankan sekali, saat cek status berikutnya sebelum dijawab. */
  duringStatusQuery: null as null | (() => Promise<void>),
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

import { acquireLock } from "@/lib/distributed-lock";
import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { encryptApiKey } from "@/lib/utils/encryption";
import { BillingEventDispatcher } from "@/modules/events";
import {
  setGatewayConfigRevoked,
  withCustomerCheckoutLock,
} from "@/modules/payment-gateway";
import { expireStaleGatewayPayments } from "@/modules/payment-gateway/services/abandoned-checkout";
import { getCustomerInvoicePaymentSnapshot } from "@/modules/finance/services/CustomerPaymentFinanceService";
import { ManualPaymentAdminRouteService } from "@/modules/finance/services/ManualPaymentAdminRouteService";
import { WebhookProcessingService } from "@/modules/payment-gateway/services/webhook-processing-service";
import { CustomerInvoiceRepository } from "@/modules/pelanggan/repositories/CustomerInvoiceRepository";
import {
  cancelCustomerManualCheckout,
  checkCustomerPaymentStatus,
} from "@/modules/pelanggan/services/CustomerPaymentCheckoutService";
import { createCustomerPaymentForRoute } from "@/modules/pelanggan/services/CustomerPaymentRouteService";

const hasTestDb = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = hasTestDb ? describe : describe.skip;

const TENANT = "tenant-gwfix-bayar";
const PROFIL = "profil-gwfix-bayar";
const PAKET = "paket-gwfix-bayar";
const PELANGGAN = "pel-gwfix-bayar";
const COUPON = "kupon-gwfix-bayar";
const COUPON_CODE = "GWFIXHEMAT";
const CONFIG_ID = "cfg-gwfix-duitku";
const MERCHANT = "DGWFIX1";
const API_KEY = "gwfix-api-key-for-tests-only";
// Tenant kedua dengan Duitku-nya sendiri; hanya baris billing yang perlu.
const TENANT_B = "tenant-gwfix-b";
const CONFIG_B = "cfg-gwfix-duitku-b";
const MERCHANT_B = "DGWFIX2";
const API_KEY_B = "gwfix-api-key-b-for-tests-only";
const PELANGGAN_B = "pel-gwfix-b";
const BANK_ACCOUNT = "rekening-gwfix";
const MANUAL_METHOD = `MANUAL_${BANK_ACCOUNT}`;
const PRICE = 100000n;
const DISCOUNT = 10000n;
// 11 Nov 2026 00:00 WIB.
const DUE = new Date("2026-11-10T17:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

const dispatcher = vi.mocked(BillingEventDispatcher);

function jsonResponse(body: unknown, status = 200) {
  return { status, text: async () => JSON.stringify(body) };
}

/**
 * Duitku palsu: inquiry berhasil kecuali `rejectInquiry`; transactionStatus
 * menjawab lunas hanya untuk order di `paidOrders`, dengan nominal yang
 * dikirim saat inquiry.
 */
const inquiryAmounts = new Map<string, number>();
async function fakeDuitku(url: string, init: { body: string }) {
  if (http.unreachable) throw new Error("connect ETIMEDOUT");
  const body = JSON.parse(init.body) as {
    merchantOrderId: string;
    paymentAmount?: number;
  };
  if (url.endsWith("/merchant/v2/inquiry")) {
    if (http.rejectInquiry) {
      return jsonResponse({ Message: "Payment channel not available" }, 404);
    }
    inquiryAmounts.set(body.merchantOrderId, body.paymentAmount ?? 0);
    return jsonResponse({
      statusCode: "00",
      statusMessage: "SUCCESS",
      reference: `DREF-${body.merchantOrderId}`,
      vaNumber: "7007014000000001",
      qrString: "00020101021226610016ID.CO.SHOPEE.WWW",
      paymentUrl: "https://sandbox.duitku.com/gwfix",
    });
  }
  if (url.endsWith("/merchant/transactionStatus")) {
    const interleaved = http.duringStatusQuery;
    http.duringStatusQuery = null;
    await interleaved?.();
    const amount = String(
      inquiryAmounts.get(body.merchantOrderId) ?? Number(PRICE),
    );
    return jsonResponse(
      http.paidOrders.has(body.merchantOrderId)
        ? {
            merchantOrderId: body.merchantOrderId,
            reference: `DREF-${body.merchantOrderId}`,
            amount,
            fee: "4000",
            statusCode: "00",
            statusMessage: "SUCCESS",
          }
        : { merchantOrderId: body.merchantOrderId, statusCode: "01" },
    );
  }
  throw new Error(`[gwfix] unexpected outbound call to ${url}`);
}

function asTenant<T>(task: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    task,
  );
}

async function cleanup() {
  const payments = await prismaBillingAuth.payment.findMany({
    where: { pelangganId: { in: [PELANGGAN, PELANGGAN_B] } },
    select: { reference: true },
  });
  const references = payments.flatMap((p) =>
    p.reference ? [p.reference] : [],
  );
  await prismaBillingAuth.webhookEvent.deleteMany({
    where: { orderId: { in: references } },
  });
  await prismaBillingAuth.webhookEvent.deleteMany({
    where: { orderId: { startsWith: "PAY-GWFIX-" } },
  });
  await prismaBillingAuth.payment.deleteMany({
    where: { pelangganId: { in: [PELANGGAN, PELANGGAN_B] } },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { pelangganId: { in: [PELANGGAN, PELANGGAN_B] } },
  });
  await prismaBillingAuth.paymentGatewayConfig.deleteMany({
    where: { id: { in: [CONFIG_ID, CONFIG_B] } },
  });
  await prismaAuth.companyBankAccount.deleteMany({
    where: { id: BANK_ACCOUNT },
  });
  await prismaAuth.couponUsage.deleteMany({ where: { couponId: COUPON } });
  await prismaAuth.coupon.deleteMany({ where: { id: COUPON } });
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
      remoteAddress: "pool-gwfix",
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
      idPelanggan: "99990091",
      nama: "Pelanggan Gwfix Bayar",
      username: "gwfix-bayar",
      password: "pppoe-gwfix",
      hargaPaketId: PAKET,
      tanggalAktif: new Date("2026-09-11T00:00:00+07:00"),
      jatuhTempo: DUE,
      status: "ISOLIR",
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

async function createCoupon(quota: number) {
  await prismaAuth.coupon.create({
    data: {
      id: COUPON,
      code: COUPON_CODE,
      discountType: "FIXED",
      discountValue: Number(DISCOUNT),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      quota,
      usedCount: 0,
      tenantId: TENANT,
    },
  });
}

function createInvoice(
  invoiceNumber: string,
  total: bigint,
  issueDate = new Date("2026-10-28T03:00:00.000Z"),
  dueDate = DUE,
) {
  return prismaBillingAuth.invoice.create({
    data: {
      id: randomUUID(),
      invoiceNumber,
      pelangganId: PELANGGAN,
      issueDate,
      dueDate,
      status: "SENT",
      subtotal: total,
      totalAmount: total,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Checkout VA BCA seperti yang ditinggalkan portal setelah inquiry berhasil. */
function createOpenVa(
  invoiceId: string,
  reference: string,
  expiresAt = new Date(Date.now() + 23 * HOUR_MS),
  owner = { pelangganId: PELANGGAN, tenantId: TENANT },
) {
  return prismaBillingAuth.payment.create({
    data: {
      id: randomUUID(),
      invoiceId,
      pelangganId: owner.pelangganId,
      amount: PRICE,
      checkoutId: randomUUID(),
      paymentDate: new Date(),
      paymentMethod: "BANK_TRANSFER",
      reference,
      gatewayStatus: "PENDING",
      gatewayProvider: "BC",
      transactionId: `DREF-${reference}`,
      vaNumber: "7007014000000001",
      expiresAt,
      tenantId: owner.tenantId,
      updatedAt: new Date(),
    },
  });
}

/** Tenant kedua: konfigurasi Duitku dan satu tagihan dengan VA terbuka. */
async function seedTenantB(reference: string) {
  await prismaBillingAuth.paymentGatewayConfig.create({
    data: {
      id: CONFIG_B,
      provider: "DUITKU",
      providerName: "DUITKU",
      isEnabled: true,
      isProduction: false,
      priority: 0,
      apiKey: encryptApiKey(API_KEY_B),
      merchantId: MERCHANT_B,
      tenantId: TENANT_B,
      updatedAt: new Date(),
    },
  });
  const inv = await prismaBillingAuth.invoice.create({
    data: {
      id: randomUUID(),
      invoiceNumber: `GWF-B-${reference}`,
      pelangganId: PELANGGAN_B,
      issueDate: new Date("2026-10-28T03:00:00.000Z"),
      dueDate: DUE,
      status: "SENT",
      subtotal: PRICE,
      totalAmount: PRICE,
      tenantId: TENANT_B,
      updatedAt: new Date(),
    },
  });
  const va = await createOpenVa(inv.id, reference, undefined, {
    pelangganId: PELANGGAN_B,
    tenantId: TENANT_B,
  });
  return { inv, va };
}

/** Callback Duitku bertanda tangan HMAC-SHA256(merchantCode+amount+merchantOrderId, apiKey). */
function duitkuCallback(input: {
  merchantOrderId: string;
  amount: bigint;
  reference: string;
  paymentCode?: string;
  apiKey?: string;
  merchantCode?: string;
  resultCode?: string;
}) {
  const amount = input.amount.toString();
  const merchantCode = input.merchantCode ?? MERCHANT;
  const signature = createHmac("sha256", input.apiKey ?? API_KEY)
    .update(`${merchantCode}${amount}${input.merchantOrderId}`)
    .digest("hex");
  const rawBody = new URLSearchParams({
    merchantCode,
    amount,
    merchantOrderId: input.merchantOrderId,
    productDetail: "Pembayaran Tagihan NetManager",
    additionalParam: "",
    paymentCode: input.paymentCode ?? "BC",
    resultCode: input.resultCode ?? "00",
    merchantUserId: "",
    reference: input.reference,
    signature,
    settlementDate: "2026-10-31 10:00:00",
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

const invoice = (id: string) =>
  prismaBillingAuth.invoice.findUniqueOrThrow({ where: { id } });

const paymentsOf = (invoiceId: string) =>
  prismaBillingAuth.payment.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "asc" },
  });

async function couponUsedCount() {
  const coupon = await prismaAuth.coupon.findUniqueOrThrow({
    where: { id: COUPON },
  });
  return coupon.usedCount;
}

const statusQueries = () =>
  http.fetch.mock.calls.filter(([url]) =>
    String(url).endsWith("/merchant/transactionStatus"),
  ).length;

const sweep = () =>
  runAsSystemContext("tes: penyapu checkout", () =>
    expireStaleGatewayPayments(new Date()),
  );

const acquireAnyLock = async () => async (): Promise<void> => undefined;

/**
 * Kunci yang benar-benar eksklusif: yang sedang dipegang tidak bisa diambil
 * lagi sampai dilepas. `acquireLock` asli menunggu sebentar lalu menyerah
 * dengan null.
 */
function holdLocksExclusively() {
  const held = new Set<string>();
  vi.mocked(acquireLock).mockImplementation(async (key: string) => {
    if (held.has(key)) return null;
    held.add(key);
    return async () => {
      held.delete(key);
    };
  });
}

describeDb("pembayaran pelanggan lewat gateway (DB nyata)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(acquireLock).mockImplementation(acquireAnyLock);
    http.paidOrders.clear();
    http.unreachable = false;
    http.rejectInquiry = false;
    http.duringStatusQuery = null;
    inquiryAmounts.clear();
    http.fetch.mockImplementation(async (url: string, init: { body: string }) =>
      fakeDuitku(url, init),
    );
    await cleanup();
    await seed();
  });

  afterAll(cleanup);

  it("[control] callback Duitku ganda melunasi invoice tepat sekali", async () => {
    const inv = await createInvoice("GWF-C1", PRICE);
    const va = await createOpenVa(inv.id, "PAY-GWFIX-C1");
    const callback = {
      merchantOrderId: va.reference!,
      amount: PRICE,
      reference: va.transactionId!,
    };

    const first = await duitkuCallback(callback);
    const second = await duitkuCallback(callback);
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

  it("[control] callback bertanda tangan kunci lain ditolak tanpa mengubah apa pun", async () => {
    const inv = await createInvoice("GWF-C2", PRICE);
    const va = await createOpenVa(inv.id, "PAY-GWFIX-C2");

    const forged = await duitkuCallback({
      merchantOrderId: va.reference!,
      amount: PRICE,
      reference: va.transactionId!,
      apiKey: "attacker-guess",
    });

    expect({
      http: forged.status,
      status: (await invoice(inv.id)).status,
    }).toEqual({ http: 401, status: "SENT" });
  });

  it("[control] VA lama yang dibayar setelah QRIS baru dikreditkan ke saldo", async () => {
    const inv = await createInvoice("GWF-C3", PRICE);
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
    await duitkuCallback({
      merchantOrderId: va.reference!,
      amount: PRICE,
      reference: va.transactionId!,
    });
    const saldo = await prismaAuth.pelanggan.findUniqueOrThrow({
      where: { id: PELANGGAN },
      select: { saldoKreditRupiah: true },
    });

    expect({
      vaStatusBeforePayment: va.gatewayStatus,
      invoiceStatus: (await invoice(inv.id)).status,
      saldoKredit: saldo.saldoKreditRupiah,
    }).toEqual({
      vaStatusBeforePayment: "CANCELLED",
      invoiceStatus: "PAID",
      saldoKredit: PRICE,
    });
  });

  describe("penyapu checkout kedaluwarsa (M4)", () => {
    it("bertanya ke Duitku dulu dan melunasi checkout yang callback-nya hilang", async () => {
      const inv = await createInvoice("GWF-S1", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-S1",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      http.paidOrders.add(va.reference!);

      await sweep();

      const failedNotices = dispatcher.onPaymentFailed.mock.calls.filter(
        ([payload]) => (payload as { invoiceId: string }).invoiceId === inv.id,
      ).length;
      const after = await prismaBillingAuth.payment.findUniqueOrThrow({
        where: { id: va.id },
      });
      expect({
        duitkuStatusQueries: statusQueries(),
        paymentStatus: after.gatewayStatus,
        gatewayFee: after.gatewayFee,
        invoiceStatus: (await invoice(inv.id)).status,
        paymentFailedNoticesSent: failedNotices,
        invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
      }).toEqual({
        duitkuStatusQueries: 1,
        paymentStatus: "PAID",
        gatewayFee: 4000n,
        invoiceStatus: "PAID",
        paymentFailedNoticesSent: 0,
        invoicePaidEvents: 1,
      });
    });

    it("callback yang datang setelah penyapu melunasi tidak melunasi dua kali", async () => {
      const inv = await createInvoice("GWF-S2", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-S2",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      http.paidOrders.add(va.reference!);

      await sweep();
      const late = await duitkuCallback({
        merchantOrderId: va.reference!,
        amount: PRICE,
        reference: va.transactionId!,
      });
      const after = await invoice(inv.id);
      const saldo = await prismaAuth.pelanggan.findUniqueOrThrow({
        where: { id: PELANGGAN },
        select: { saldoKreditRupiah: true },
      });

      expect({
        lateCallback: late.status,
        paidAmount: after.paidAmount,
        saldoKredit: saldo.saldoKreditRupiah,
        invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
      }).toEqual({
        lateCallback: 200,
        paidAmount: PRICE,
        saldoKredit: 0n,
        invoicePaidEvents: 1,
      });
    });

    it("menutup checkout yang menurut Duitku belum dibayar", async () => {
      const inv = await createInvoice("GWF-S3", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-S3",
        new Date(Date.now() - 2 * HOUR_MS),
      );

      const expired = await sweep();

      expect({
        expired,
        paymentStatus: (
          await prismaBillingAuth.payment.findUniqueOrThrow({
            where: { id: va.id },
          })
        ).gatewayStatus,
        notices: dispatcher.onPaymentFailed.mock.calls.length,
      }).toEqual({ expired: 1, paymentStatus: "EXPIRED", notices: 1 });
    });

    it("tidak menutup apa pun bila Duitku tidak bisa ditanya", async () => {
      const inv = await createInvoice("GWF-S4", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-S4",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      http.unreachable = true;

      const expired = await sweep();

      expect({
        expired,
        paymentStatus: (
          await prismaBillingAuth.payment.findUniqueOrThrow({
            where: { id: va.id },
          })
        ).gatewayStatus,
        notices: dispatcher.onPaymentFailed.mock.calls.length,
      }).toEqual({ expired: 0, paymentStatus: "PENDING", notices: 0 });
    });
  });

  // Cek status dan penyapu dulu hanya mencatat log saat nominal Duitku
  // berbeda; staf keuangan tidak tahu ada uang yang tidak dilunasi.
  it.each([
    [
      "cek status dari portal",
      (invoiceId: string) =>
        asTenant(() =>
          checkCustomerPaymentStatus({ customerId: PELANGGAN, invoiceId }),
        ),
    ],
    [
      "penyapu checkout",
      () =>
        runAsSystemContext("tes: penyapu checkout", () =>
          expireStaleGatewayPayments(new Date()),
        ),
    ],
  ])(
    "nominal Duitku yang berbeda tidak dilunasi oleh %s dan diteruskan ke staf keuangan",
    async (_path, run) => {
      const inv = await createInvoice("GWF-R1", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-R1",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      http.paidOrders.add(va.reference!);
      inquiryAmounts.set(va.reference!, 60_000);

      await run(inv.id);

      expect({
        paymentStatus: (
          await prismaBillingAuth.payment.findUniqueOrThrow({
            where: { id: va.id },
          })
        ).gatewayStatus,
        invoiceStatus: (await invoice(inv.id)).status,
        review: dispatcher.onPaymentReviewRequired.mock.calls.map(([data]) => [
          data.provider,
          data.paymentId,
          data.reason,
          data.expected,
          data.received,
        ]),
      }).toEqual({
        paymentStatus: "PENDING",
        invoiceStatus: "SENT",
        review: [["DUITKU", va.id, "AMOUNT_MISMATCH", "100000", "60000"]],
      });
    },
  );

  it("callback untuk VA yang sudah terbit tetap diterima setelah konfigurasi Duitku dimatikan (M5)", async () => {
    const inv = await createInvoice("GWF-M5", PRICE);
    const va = await createOpenVa(inv.id, "PAY-GWFIX-M5");
    await prismaBillingAuth.paymentGatewayConfig.update({
      where: { id: CONFIG_ID },
      data: { isEnabled: false },
    });

    const callback = await duitkuCallback({
      merchantOrderId: va.reference!,
      amount: PRICE,
      reference: va.transactionId!,
    });

    expect({
      callbackHttp: callback.status,
      invoiceStatus: (await invoice(inv.id)).status,
    }).toEqual({ callbackHttp: 200, invoiceStatus: "PAID" });
  });

  describe("konfigurasi gateway per tenant", () => {
    it("sakelar darurat dari pengaturan admin hanya mengubah konfigurasi tenant itu", async () => {
      await seedTenantB("PAY-GWFIX-KS1");
      const revocationOf = async () =>
        Object.fromEntries(
          (
            await prismaBillingAuth.paymentGatewayConfig.findMany({
              where: { id: { in: [CONFIG_ID, CONFIG_B] } },
              select: { id: true, isRevoked: true, isEnabled: true },
            })
          ).map(({ id, ...state }) => [id, state]),
        );

      const revoked = await setGatewayConfigRevoked({
        provider: "DUITKU",
        tenantId: TENANT,
        isRevoked: true,
      });
      const whileRevoked = await revocationOf();
      await setGatewayConfigRevoked({
        provider: "DUITKU",
        tenantId: TENANT,
        isRevoked: false,
      });

      expect({ revoked, whileRevoked, after: await revocationOf() }).toEqual({
        revoked: { id: CONFIG_ID, provider: "DUITKU", isRevoked: true },
        whileRevoked: {
          [CONFIG_ID]: { isRevoked: true, isEnabled: true },
          [CONFIG_B]: { isRevoked: false, isEnabled: true },
        },
        after: {
          [CONFIG_ID]: { isRevoked: false, isEnabled: true },
          [CONFIG_B]: { isRevoked: false, isEnabled: true },
        },
      });
    });

    // Dulu tanpa payment yang dikenali, kunci tenant pertama mana pun dipakai.
    it("callback untuk payment yang tidak ada ditolak tanpa mencoba konfigurasi tenant lain", async () => {
      await seedTenantB("PAY-GWFIX-B0");

      const callback = await duitkuCallback({
        merchantOrderId: "PAY-GWFIX-TIDAK-ADA",
        amount: PRICE,
        reference: "DREF-TIDAK-ADA",
      });
      const events = await prismaBillingAuth.webhookEvent.count({
        where: { orderId: "PAY-GWFIX-TIDAK-ADA" },
      });

      expect({ accepted: callback.status === 200, events }).toEqual({
        accepted: false,
        events: 0,
      });
    });

    it("dua tenant: tiap callback diverifikasi dengan kunci tenantnya sendiri", async () => {
      const { inv: invB, va: vaB } = await seedTenantB("PAY-GWFIX-B1");
      const invA = await createInvoice("GWF-A1", PRICE);
      const vaA = await createOpenVa(invA.id, "PAY-GWFIX-A1");

      const forgedForB = await duitkuCallback({
        merchantOrderId: vaB.reference!,
        amount: PRICE,
        reference: vaB.transactionId!,
        merchantCode: MERCHANT_B,
        apiKey: API_KEY,
      });
      const paidB = await duitkuCallback({
        merchantOrderId: vaB.reference!,
        amount: PRICE,
        reference: vaB.transactionId!,
        merchantCode: MERCHANT_B,
        apiKey: API_KEY_B,
      });
      const paidA = await duitkuCallback({
        merchantOrderId: vaA.reference!,
        amount: PRICE,
        reference: vaA.transactionId!,
      });

      expect({
        forgedForB: forgedForB.status,
        paidB: paidB.status,
        paidA: paidA.status,
        invoiceB: (await invoice(invB.id)).status,
        invoiceA: (await invoice(invA.id)).status,
      }).toEqual({
        forgedForB: 401,
        paidB: 200,
        paidA: 200,
        invoiceB: "PAID",
        invoiceA: "PAID",
      });
    });

    // Sakelar darurat untuk kredensial yang bocor.
    it("konfigurasi yang dicabut menolak callback dan cek status", async () => {
      const inv = await createInvoice("GWF-R1", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-R1",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      http.paidOrders.add(va.reference!);
      await prismaBillingAuth.paymentGatewayConfig.update({
        where: { id: CONFIG_ID },
        data: { isRevoked: true },
      });

      const callback = await duitkuCallback({
        merchantOrderId: va.reference!,
        amount: PRICE,
        reference: va.transactionId!,
      });
      await runAsSystemContext("tes: penyapu checkout", () =>
        expireStaleGatewayPayments(new Date()),
      );

      expect({
        callbackAccepted: callback.status === 200,
        statusQueries: statusQueries(),
        paymentStatus: (
          await prismaBillingAuth.payment.findUniqueOrThrow({
            where: { id: va.id },
          })
        ).gatewayStatus,
        invoiceStatus: (await invoice(inv.id)).status,
      }).toEqual({
        callbackAccepted: false,
        statusQueries: 0,
        paymentStatus: "PENDING",
        invoiceStatus: "SENT",
      });
    });
  });

  describe("cek status dari portal (C3 check-status)", () => {
    const checkStatus = (invoiceId: string) =>
      asTenant(() =>
        checkCustomerPaymentStatus({ customerId: PELANGGAN, invoiceId }),
      );

    it("melunasi checkout yang sudah dibayar lewat jalur webhook, dengan kuponnya", async () => {
      await createCoupon(1);
      const inv = await createInvoice("GWF-K1", PRICE);
      await payFromPortal([inv.id], "BC", COUPON_CODE);
      const [va] = await paymentsOf(inv.id);
      http.paidOrders.add(va.reference!);

      const status = await checkStatus(inv.id);
      const again = await checkStatus(inv.id);
      const after = await invoice(inv.id);
      const paid = await prismaBillingAuth.payment.findUniqueOrThrow({
        where: { id: va.id },
      });

      expect({
        status,
        again,
        invoiceStatus: after.status,
        paidAmount: after.paidAmount,
        paymentStatus: paid.gatewayStatus,
        couponStillReserved: paid.couponUsageId !== null,
        couponUsedCount: await couponUsedCount(),
        invoicePaidEvents: dispatcher.onInvoicePaid.mock.calls.length,
      }).toEqual({
        status: "PAID",
        again: "PAID",
        invoiceStatus: "PAID",
        paidAmount: PRICE,
        paymentStatus: "PAID",
        couponStillReserved: true,
        couponUsedCount: 1,
        invoicePaidEvents: 1,
      });
    });

    it("menjawab PENDING tanpa mengubah apa pun selama Duitku belum menerima uang", async () => {
      const inv = await createInvoice("GWF-K2", PRICE);
      await payFromPortal([inv.id], "BC");

      expect({
        status: await checkStatus(inv.id),
        invoiceStatus: (await invoice(inv.id)).status,
      }).toEqual({ status: "PENDING", invoiceStatus: "SENT" });
    });

    it("menjawab NONE tanpa checkout gateway dan PENDING untuk transfer manual", async () => {
      const kosong = await createInvoice("GWF-K3", PRICE);
      const manual = await createInvoice("GWF-K4", PRICE);
      await payFromPortal([manual.id], MANUAL_METHOD);

      expect({
        none: await checkStatus(kosong.id),
        manual: await checkStatus(manual.id),
        statusQueries: statusQueries(),
      }).toEqual({ none: "NONE", manual: "PENDING", statusQueries: 0 });
    });
  });

  it("checkout dua invoice: nominal pasti yang ditampilkan sama dengan tagihan Duitku (C1)", async () => {
    const older = await createInvoice(
      "GWF-9A",
      PRICE,
      new Date("2026-10-01T03:00:00.000Z"),
      new Date("2026-10-10T17:00:00.000Z"),
    );
    const newer = await createInvoice(
      "GWF-9B",
      150000n,
      new Date("2026-10-20T03:00:00.000Z"),
    );

    await payFromPortal([newer.id, older.id], "BC");

    const inquiry = http.fetch.mock.calls.find(([url]) =>
      String(url).endsWith("/merchant/v2/inquiry"),
    )!;
    const charged = (
      JSON.parse((inquiry[1] as { body: string }).body) as {
        paymentAmount: number;
      }
    ).paymentAmount;
    const repository = new CustomerInvoiceRepository();
    const { invoices: rows } = await asTenant(() =>
      repository.findAllForCustomer(PELANGGAN, {
        page: 1,
        limit: 20,
        status: ["SENT", "OVERDUE", "PARTIAL_PAID"],
      }),
    );
    const shown = repository
      .formatInvoicesForResponse(rows)
      .find((row) => row.lastPayment?.gatewayStatus === "PENDING")?.lastPayment;

    expect({
      chargedByDuitku: charged,
      checkoutTotal: shown?.checkoutTotal,
      checkoutInvoiceNumbers: shown?.checkoutInvoiceNumbers,
      isManual: shown?.isManual,
    }).toEqual({
      chargedByDuitku: 250000,
      checkoutTotal: 250000,
      checkoutInvoiceNumbers: ["GWF-9A", "GWF-9B"],
      isManual: false,
    });
  });

  describe("pembayaran Rp 0 dalam checkout", () => {
    // Kupon yang menutup penuh invoice pertama membuat payment Rp 0 yang
    // langsung PAID. Bila payment itu menjadi orderId Duitku, callback-nya
    // dijawab "Already processed" dan invoice lain tidak pernah lunas.
    it("kupon yang menutup penuh invoice pertama: callback melunasi invoice lainnya", async () => {
      await createCoupon(1);
      const small = await createInvoice(
        "GWF-Z1",
        DISCOUNT,
        new Date("2026-10-01T03:00:00.000Z"),
      );
      const big = await createInvoice("GWF-Z2", PRICE);

      await payFromPortal([small.id, big.id], "BC", COUPON_CODE);

      const inquiry = http.fetch.mock.calls.find(([url]) =>
        String(url).endsWith("/merchant/v2/inquiry"),
      )!;
      const order = JSON.parse((inquiry[1] as { body: string }).body) as {
        merchantOrderId: string;
        paymentAmount: number;
      };
      const [zeroRow] = await paymentsOf(small.id);
      const [bigRow] = await paymentsOf(big.id);
      const callback = await duitkuCallback({
        merchantOrderId: order.merchantOrderId,
        amount: BigInt(order.paymentAmount),
        reference: `DREF-${order.merchantOrderId}`,
      });

      expect({
        orderRow: order.merchantOrderId,
        charged: order.paymentAmount,
        zeroRowStatus: zeroRow.gatewayStatus,
        zeroRowExpiresAt: zeroRow.expiresAt,
        callback: callback.status,
        bigInvoice: (await invoice(big.id)).status,
        smallInvoice: (await invoice(small.id)).status,
      }).toEqual({
        orderRow: bigRow.reference,
        charged: Number(PRICE),
        zeroRowStatus: "PAID",
        zeroRowExpiresAt: null,
        callback: 200,
        bigInvoice: "PAID",
        smallInvoice: "PAID",
      });
    });

    // Callback gagal dulu mengembalikan kupon seluruh checkout, padahal
    // invoice Rp 0 yang tertutup kupon itu sudah lunas memakainya.
    it("callback gagal menutup payment yang menunggu tanpa melepas kupon invoice Rp 0", async () => {
      await createCoupon(1);
      const small = await createInvoice(
        "GWF-Z4",
        DISCOUNT,
        new Date("2026-10-01T03:00:00.000Z"),
      );
      const big = await createInvoice("GWF-Z5", PRICE);
      await payFromPortal([small.id, big.id], "BC", COUPON_CODE);
      const [bigRow] = await paymentsOf(big.id);

      await duitkuCallback({
        merchantOrderId: bigRow.reference!,
        amount: PRICE,
        reference: bigRow.transactionId!,
        resultCode: "01",
      });

      expect({
        smallRow: (await paymentsOf(small.id))[0].gatewayStatus,
        bigRow: (await paymentsOf(big.id))[0].gatewayStatus,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({ smallRow: "PAID", bigRow: "FAILED", couponUsedCount: 1 });
    });

    it("invoice Rp 0 dalam permintaan dilewati, dan permintaan yang hanya berisi Rp 0 ditolak", async () => {
      const zero = await createInvoice("GWF-Z3", 0n);
      const big = await createInvoice("GWF-Z4", PRICE);

      await payFromPortal([zero.id, big.id], "BC");
      const zeroOnly = await payFromPortal([zero.id], "BC").then(
        () => ({ status: 200 }),
        (error: { status?: number; message: string }) => ({
          status: error.status,
          message: error.message,
        }),
      );

      expect({
        zeroInvoicePayments: (await paymentsOf(zero.id)).length,
        bigInvoicePayments: (await paymentsOf(big.id)).length,
        zeroOnly,
      }).toEqual({
        zeroInvoicePayments: 0,
        bigInvoicePayments: 1,
        zeroOnly: {
          status: 400,
          message: "Tidak ada tagihan yang perlu dibayar.",
        },
      });
    });

    // Pelunasan dari cek status dulu memindahkan setiap payment checkout yang
    // belum PAID, termasuk yang REFUNDED atau FAILED (tidak pernah punya VA).
    /** Checkout dengan satu payment menunggu, satu FAILED, satu REFUNDED. */
    async function checkoutWithClosedPayments() {
      const paid = await createInvoice("GWF-S5A", PRICE);
      const failed = await createInvoice("GWF-S5B", 50_000n);
      const refunded = await createInvoice("GWF-S5C", 25_000n);
      const checkoutId = randomUUID();
      const row = (
        invoiceId: string,
        reference: string,
        amount: bigint,
        gatewayStatus: "PENDING" | "FAILED" | "REFUNDED",
      ) =>
        prismaBillingAuth.payment.create({
          data: {
            id: randomUUID(),
            invoiceId,
            pelangganId: PELANGGAN,
            amount,
            checkoutId,
            paymentDate: new Date(),
            paymentMethod: "BANK_TRANSFER",
            reference,
            gatewayStatus,
            gatewayProvider: "BC",
            expiresAt: new Date(Date.now() + 23 * HOUR_MS),
            tenantId: TENANT,
            updatedAt: new Date(),
          },
        });
      await row(paid.id, "PAY-GWFIX-S5A", PRICE, "PENDING");
      const failedRow = await row(
        failed.id,
        "PAY-GWFIX-S5B",
        50_000n,
        "FAILED",
      );
      const refundedRow = await row(
        refunded.id,
        "PAY-GWFIX-S5C",
        25_000n,
        "REFUNDED",
      );
      http.paidOrders.add("PAY-GWFIX-S5A");
      inquiryAmounts.set("PAY-GWFIX-S5A", Number(PRICE));
      const statusOf = async (id: string) =>
        (await prismaBillingAuth.payment.findUniqueOrThrow({ where: { id } }))
          .gatewayStatus;
      return {
        paid,
        statuses: async () => ({
          paidInvoice: (await invoice(paid.id)).status,
          failedRow: await statusOf(failedRow.id),
          refundedRow: await statusOf(refundedRow.id),
        }),
      };
    }

    it("payment REFUNDED dan FAILED di checkout yang dilunasi tidak ikut berubah", async () => {
      const { paid, statuses } = await checkoutWithClosedPayments();

      const status = await asTenant(() =>
        checkCustomerPaymentStatus({
          customerId: PELANGGAN,
          invoiceId: paid.id,
        }),
      );

      expect({ status, ...(await statuses()) }).toEqual({
        status: "PAID",
        paidInvoice: "PAID",
        failedRow: "FAILED",
        refundedRow: "REFUNDED",
      });
    });

    // Webhook dulu menjumlah seluruh payment checkout (nominalnya dianggap
    // tidak cocok) dan memindahkan apa pun yang belum PAID.
    it("callback untuk checkout itu juga hanya memindahkan payment yang menunggu", async () => {
      const { statuses } = await checkoutWithClosedPayments();

      const callback = await duitkuCallback({
        merchantOrderId: "PAY-GWFIX-S5A",
        amount: PRICE,
        reference: "DREF-PAY-GWFIX-S5A",
      });

      expect({ callback: callback.body, ...(await statuses()) }).toEqual({
        callback: { status: "ok" },
        paidInvoice: "PAID",
        failedRow: "FAILED",
        refundedRow: "REFUNDED",
      });
    });

    // Checkout lama yang terlanjur memakai payment Rp 0 sebagai orderId.
    describe("checkout lama dengan orderId pada payment Rp 0 yang sudah PAID", () => {
      async function legacyCheckout(expiresAt: Date) {
        const small = await createInvoice("GWF-L1", DISCOUNT);
        const big = await createInvoice("GWF-L2", PRICE);
        const checkoutId = randomUUID();
        const row = (
          invoiceId: string,
          reference: string,
          amount: bigint,
          gatewayStatus: "PAID" | "PENDING",
        ) =>
          prismaBillingAuth.payment.create({
            data: {
              id: randomUUID(),
              invoiceId,
              pelangganId: PELANGGAN,
              amount,
              discountAmount: amount === 0n ? DISCOUNT : 0n,
              checkoutId,
              paymentDate: new Date(),
              paymentMethod: "BANK_TRANSFER",
              reference,
              gatewayStatus,
              gatewayProvider: "BC",
              transactionId: "DREF-PAY-GWFIX-L0",
              expiresAt,
              tenantId: TENANT,
              updatedAt: new Date(),
            },
          });
        await row(small.id, "PAY-GWFIX-L0", 0n, "PAID");
        const pending = await row(big.id, "PAY-GWFIX-L1", PRICE, "PENDING");
        http.paidOrders.add("PAY-GWFIX-L0");
        inquiryAmounts.set("PAY-GWFIX-L0", Number(PRICE));
        return { big, pending };
      }

      it("penyapu melunasi payment lain checkout itu", async () => {
        const { big, pending } = await legacyCheckout(
          new Date(Date.now() - 2 * HOUR_MS),
        );

        await runAsSystemContext("tes: penyapu checkout", () =>
          expireStaleGatewayPayments(new Date()),
        );

        expect({
          pendingRow: (
            await prismaBillingAuth.payment.findUniqueOrThrow({
              where: { id: pending.id },
            })
          ).gatewayStatus,
          bigInvoice: (await invoice(big.id)).status,
          failedNotices: dispatcher.onPaymentFailed.mock.calls.length,
        }).toEqual({
          pendingRow: "PAID",
          bigInvoice: "PAID",
          failedNotices: 0,
        });
      });

      // Webhook dulu menjawab "Already processed": payment orderId-nya PAID.
      it("callback melunasi payment lain checkout itu", async () => {
        const { big, pending } = await legacyCheckout(
          new Date(Date.now() + 23 * HOUR_MS),
        );

        const callback = await duitkuCallback({
          merchantOrderId: "PAY-GWFIX-L0",
          amount: PRICE,
          reference: "DREF-PAY-GWFIX-L0",
        });

        expect({
          callback: callback.body,
          pendingRow: (
            await prismaBillingAuth.payment.findUniqueOrThrow({
              where: { id: pending.id },
            })
          ).gatewayStatus,
          bigInvoice: (await invoice(big.id)).status,
        }).toEqual({
          callback: { status: "ok" },
          pendingRow: "PAID",
          bigInvoice: "PAID",
        });
      });

      it("cek status dari portal melunasi payment lain checkout itu", async () => {
        const { big } = await legacyCheckout(
          new Date(Date.now() + 23 * HOUR_MS),
        );

        const status = await asTenant(() =>
          checkCustomerPaymentStatus({
            customerId: PELANGGAN,
            invoiceId: big.id,
          }),
        );

        expect({
          status,
          bigInvoice: (await invoice(big.id)).status,
        }).toEqual({ status: "PAID", bigInvoice: "PAID" });
      });
    });
  });

  describe("ganti metode (M8)", () => {
    it("kupon berkuota satu tetap berlaku saat pindah dari VA ke QRIS", async () => {
      await createCoupon(1);
      const inv = await createInvoice("GWF-G1", PRICE);

      await payFromPortal([inv.id], "BC", COUPON_CODE);
      await payFromPortal([inv.id], "SP", COUPON_CODE);

      const payments = await paymentsOf(inv.id);
      const va = payments.find((p) => p.gatewayProvider === "BC")!;
      const qris = payments.find((p) => p.gatewayProvider === "SP")!;
      expect({
        vaStatus: va.gatewayStatus,
        vaHoldsCoupon: va.couponUsageId !== null,
        qrisStatus: qris.gatewayStatus,
        qrisAmount: qris.amount,
        qrisHoldsCoupon: qris.couponUsageId !== null,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({
        vaStatus: "CANCELLED",
        vaHoldsCoupon: false,
        qrisStatus: "PENDING",
        qrisAmount: PRICE - DISCOUNT,
        qrisHoldsCoupon: true,
        couponUsedCount: 1,
      });
    });

    // Ganti metode memindah pemesanan kupon VA lama ke QRIS sebelum baris
    // QRIS ada. Penyapu yang menutup VA lama di antaranya dulu melepas kupon
    // itu: QRIS memegang pemesanan yang sudah dihapus dan kuotanya kembali.
    it("penyapu yang berjalan di tengah ganti metode tidak melepas kupon yang dipindah", async () => {
      await createCoupon(1);
      const inv = await createInvoice("GWF-G3", PRICE);
      await payFromPortal([inv.id], "BC", COUPON_CODE);
      await prismaBillingAuth.payment.updateMany({
        where: { invoiceId: inv.id },
        data: { expiresAt: new Date(Date.now() - 2 * HOUR_MS) },
      });
      holdLocksExclusively();
      let expiredBySweep: number | undefined;
      // Ganti metode menanyakan VA lama ke Duitku setelah membaca kuponnya
      // dan sebelum membuat baris QRIS.
      http.duringStatusQuery = async () => {
        expiredBySweep = await sweep();
      };

      await payFromPortal([inv.id], "SP", COUPON_CODE);

      const payments = await paymentsOf(inv.id);
      const va = payments.find((p) => p.gatewayProvider === "BC")!;
      const qris = payments.find((p) => p.gatewayProvider === "SP")!;
      const qrisUsage = await prismaAuth.couponUsage.findFirst({
        where: { id: qris.couponUsageId ?? "" },
      });
      expect({
        expiredBySweep,
        vaStatus: va.gatewayStatus,
        qrisStatus: qris.gatewayStatus,
        qrisUsageExists: qrisUsage !== null,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({
        expiredBySweep: 0,
        vaStatus: "CANCELLED",
        qrisStatus: "PENDING",
        qrisUsageExists: true,
        couponUsedCount: 1,
      });
    });

    it("checkout yang dilewati penyapu karena pelanggan sibuk ditutup pada putaran berikutnya", async () => {
      const inv = await createInvoice("GWF-G4", PRICE);
      const va = await createOpenVa(
        inv.id,
        "PAY-GWFIX-G4",
        new Date(Date.now() - 2 * HOUR_MS),
      );
      holdLocksExclusively();

      // Pelanggan sedang membuat checkout di perangkat lain.
      const whileBusy = await withCustomerCheckoutLock(PELANGGAN, sweep);
      const afterwards = await sweep();

      expect({
        whileBusy,
        afterwards,
        status: (
          await prismaBillingAuth.payment.findUniqueOrThrow({
            where: { id: va.id },
          })
        ).gatewayStatus,
      }).toEqual({ whileBusy: 0, afterwards: 1, status: "EXPIRED" });
    });

    it("metode baru yang ditolak Duitku membiarkan checkout lama tetap terbuka dengan kuponnya", async () => {
      await createCoupon(1);
      const inv = await createInvoice("GWF-G2", PRICE);
      await payFromPortal([inv.id], "BC", COUPON_CODE);
      http.rejectInquiry = true;

      const outcome = await payFromPortal([inv.id], "DA", COUPON_CODE).then(
        () => ({ status: 200, message: "" }),
        (error: { status?: number; message: string }) => ({
          status: error.status,
          message: error.message,
        }),
      );

      const payments = await paymentsOf(inv.id);
      const va = payments.find((p) => p.gatewayProvider === "BC")!;
      const failed = payments.find((p) => p.gatewayStatus === "FAILED")!;
      // Yang dilihat portal dan aplikasi: daftar tagihan dan aliran SSE.
      const repository = new CustomerInvoiceRepository();
      const { invoices: rows } = await asTenant(() =>
        repository.findAllForCustomer(PELANGGAN, { page: 1, limit: 20 }),
      );
      const shown = repository.formatInvoicesForResponse(rows)[0].lastPayment;
      const stream = await asTenant(() =>
        getCustomerInvoicePaymentSnapshot({
          invoiceId: inv.id,
          customerId: PELANGGAN,
        }),
      );
      expect({
        outcome,
        vaStatus: va.gatewayStatus,
        vaHoldsCoupon: va.couponUsageId !== null,
        failedReason: failed.failureReason,
        couponUsedCount: await couponUsedCount(),
        shownPayment: shown?.id,
        shownStatus: shown?.gatewayStatus,
        streamPayment: stream?.paymentId,
        streamStatus: stream?.status,
      }).toEqual({
        outcome: {
          status: 502,
          message:
            "Metode pembayaran ini sedang tidak tersedia. Silakan pilih metode lain.",
        },
        vaStatus: "PENDING",
        vaHoldsCoupon: true,
        failedReason: expect.stringContaining("Payment channel not available"),
        couponUsedCount: 1,
        shownPayment: va.id,
        shownStatus: "PENDING",
        streamPayment: va.id,
        streamStatus: "SENT",
      });
    });
  });

  describe("transfer manual (M6)", () => {
    it("rekening tujuan tetap tampil walau sudah dinonaktifkan admin", async () => {
      await prismaAuth.companyBankAccount.create({
        data: {
          id: BANK_ACCOUNT,
          bankName: "BCA",
          accountName: "PT Gwfix",
          accountNumber: "1230000099",
          isActive: true,
          tenantId: TENANT,
        },
      });
      const inv = await createInvoice("GWF-T0", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      await prismaAuth.companyBankAccount.update({
        where: { id: BANK_ACCOUNT },
        data: { isActive: false },
      });

      const repository = new CustomerInvoiceRepository();
      const { invoices: rows } = await asTenant(() =>
        repository.findAllForCustomer(PELANGGAN, { page: 1, limit: 20 }),
      );
      const shown = repository.formatInvoicesForResponse(rows)[0].lastPayment;

      expect({
        isManual: shown?.isManual,
        bankAccount: shown?.bankAccount,
      }).toEqual({
        isManual: true,
        bankAccount: {
          bankName: "BCA",
          accountName: "PT Gwfix",
          accountNumber: "1230000099",
        },
      });
    });

    it("memilih Transfer Manual dua kali menyisakan satu transfer menunggu", async () => {
      const inv = await createInvoice("GWF-T1", PRICE);

      await payFromPortal([inv.id], MANUAL_METHOD);
      await payFromPortal([inv.id], MANUAL_METHOD);

      const pending = await prismaBillingAuth.payment.count({
        where: {
          invoiceId: inv.id,
          accountId: { not: null },
          gatewayStatus: "PENDING",
        },
      });
      expect(pending).toBe(1);
    });

    it("bukti yang sedang diverifikasi menolak checkout baru dengan pesan jelas", async () => {
      const inv = await createInvoice("GWF-T2", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);
      await prismaBillingAuth.payment.updateMany({
        where: { invoiceId: inv.id, gatewayStatus: "PENDING" },
        data: { receiptUrl: "/uploads/tenants/x/payment-proofs/bukti.webp" },
      });

      const outcome = await payFromPortal([inv.id], "SP").then(
        () => ({ status: 200 }),
        (error: { status?: number; message: string }) => ({
          status: error.status,
          message: error.message,
        }),
      );

      expect({
        outcome,
        stillPending: await prismaBillingAuth.payment.count({
          where: { invoiceId: inv.id, gatewayStatus: "PENDING" },
        }),
        inquiries: http.fetch.mock.calls.length,
      }).toEqual({
        outcome: {
          status: 409,
          message: expect.stringMatching(/sedang diverifikasi/i),
        },
        stillPending: 1,
        inquiries: 0,
      });
    });

    it("memilih gateway menutup transfer manual yang belum berbukti", async () => {
      const inv = await createInvoice("GWF-T3", PRICE);
      await payFromPortal([inv.id], MANUAL_METHOD);

      await payFromPortal([inv.id], "SP");

      const payments = await paymentsOf(inv.id);
      expect(
        payments.map((p) => [p.accountId !== null, p.gatewayStatus]),
      ).toEqual([
        [true, "CANCELLED"],
        [false, "PENDING"],
      ]);
    });

    it("membatalkan transfer manual menutup seluruh checkout-nya dan mengembalikan kupon", async () => {
      await createCoupon(1);
      const a = await createInvoice("GWF-T4A", PRICE);
      const b = await createInvoice("GWF-T4B", PRICE);
      await payFromPortal([a.id, b.id], MANUAL_METHOD, COUPON_CODE);

      await asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: b.id,
        }),
      );
      const again = await asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: b.id,
        }),
      ).then(
        () => 200,
        (error: { status?: number }) => error.status,
      );

      const statuses = await prismaBillingAuth.payment.findMany({
        where: { pelangganId: PELANGGAN },
        select: { gatewayStatus: true },
      });
      expect({
        statuses: statuses.map((p) => p.gatewayStatus),
        couponUsedCount: await couponUsedCount(),
        secondCancel: again,
      }).toEqual({
        statuses: ["CANCELLED", "CANCELLED"],
        couponUsedCount: 0,
        secondCancel: 409,
      });
    });

    // Admin menyetujui satu invoice checkout saat pelanggan membatalkannya:
    // dulu sisa payment tetap dibatalkan dan kupon seluruh checkout dilepas,
    // padahal potongannya sudah dipakai invoice yang disetujui.
    it("pembatalan yang berbarengan dengan persetujuan admin tidak membatalkan apa pun", async () => {
      await createCoupon(1);
      const a = await createInvoice("GWF-T5A", PRICE);
      const b = await createInvoice("GWF-T5B", PRICE);
      await payFromPortal([a.id, b.id], MANUAL_METHOD, COUPON_CODE);
      const [rowA] = await paymentsOf(a.id);

      let lockHeld!: () => void;
      let releaseAdmin!: () => void;
      const locked = new Promise<void>((resolve) => (lockHeld = resolve));
      const adminMayCommit = new Promise<void>(
        (resolve) => (releaseAdmin = resolve),
      );
      const approval = prismaBillingAuth.$transaction(
        async (tx) => {
          await tx.payment.update({
            where: { id: rowA.id },
            data: { gatewayStatus: "PAID", paymentDate: new Date() },
          });
          lockHeld();
          await adminMayCommit;
        },
        { timeout: 30_000 },
      );
      await locked;

      const cancel = asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: b.id,
        }),
      ).then(
        () => ({ status: 200, message: "" }),
        (error: { status?: number; message: string }) => ({
          status: error.status,
          message: error.message,
        }),
      );
      await waitForBlockedPaymentUpdate();
      releaseAdmin();
      await approval;

      const statuses = Object.fromEntries(
        (
          await prismaBillingAuth.payment.findMany({
            where: { pelangganId: PELANGGAN },
            select: { invoiceId: true, gatewayStatus: true },
          })
        ).map((p) => [p.invoiceId === a.id ? "a" : "b", p.gatewayStatus]),
      );
      expect({
        cancel: await cancel,
        statuses,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({
        cancel: {
          status: 409,
          message: expect.stringMatching(/baru saja diproses admin/),
        },
        statuses: { a: "PAID", b: "PENDING" },
        couponUsedCount: 1,
      });
    });

    // Persetujuan per payment (sebelum persetujuan berlaku untuk seluruh
    // checkout) meninggalkan checkout yang sebagian sudah disetujui, tanpa
    // verifiedAt. Sisa checkout yang dibatalkan setelah satu invoice disetujui
    // tidak bisa lagi disetujui admin.
    it("transfer manual yang sebagian invoicenya sudah disetujui admin tidak bisa dibatalkan", async () => {
      await createCoupon(1);
      const a = await createInvoice("GWF-T7A", PRICE);
      const b = await createInvoice("GWF-T7B", PRICE);
      await payFromPortal([a.id, b.id], MANUAL_METHOD, COUPON_CODE);
      const [rowA] = await paymentsOf(a.id);
      await prismaBillingAuth.payment.update({
        where: { id: rowA.id },
        data: { gatewayStatus: "PAID", paymentDate: new Date() },
      });

      const cancel = await asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: b.id,
        }),
      ).then(
        () => 200,
        (error: { status?: number }) => error.status,
      );

      expect({
        cancel,
        rowA: (await paymentsOf(a.id))[0].gatewayStatus,
        rowB: (await paymentsOf(b.id))[0].gatewayStatus,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({
        cancel: 409,
        rowA: "PAID",
        rowB: "PENDING",
        couponUsedCount: 1,
      });
    });

    // Admin menyetujui satu baris dari daftar verifikasi; uang transfernya
    // untuk seluruh checkout, jadi seluruhnya disetujui sekaligus.
    it("persetujuan admin berlaku untuk seluruh checkout dan pembatalan sesudahnya ditolak", async () => {
      await createCoupon(1);
      const a = await createInvoice("GWF-T8A", PRICE);
      const b = await createInvoice("GWF-T8B", PRICE);
      await payFromPortal([a.id, b.id], MANUAL_METHOD, COUPON_CODE);
      const [rowA] = await paymentsOf(a.id);

      await asTenant(() =>
        new ManualPaymentAdminRouteService().verifyManualPayment({
          paymentId: rowA.id,
          action: "APPROVE",
          verifiedBy: "Admin Keuangan",
        }),
      );
      const cancel = await asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: b.id,
        }),
      ).then(
        () => 200,
        (error: { status?: number }) => error.status,
      );

      const rows = await prismaBillingAuth.payment.findMany({
        where: { pelangganId: PELANGGAN },
        select: { gatewayStatus: true, verifiedAt: true, verifiedBy: true },
      });
      expect({
        cancel,
        rows: rows.map((p) => [
          p.gatewayStatus,
          p.verifiedAt !== null,
          p.verifiedBy,
        ]),
        invoices: [(await invoice(a.id)).status, (await invoice(b.id)).status],
        couponUsedCount: await couponUsedCount(),
      }).toEqual({
        cancel: 409,
        rows: [
          ["PAID", true, "Admin Keuangan"],
          ["PAID", true, "Admin Keuangan"],
        ],
        invoices: ["PAID", "PAID"],
        couponUsedCount: 1,
      });
    });

    // Persetujuan dulu memindahkan payment satu per satu dan menerima hasil
    // sebagian. Pembatalan pelanggan yang commit selagi persetujuan menunggu
    // kunci barisnya kini membuat persetujuan gagal bersih.
    it("persetujuan admin yang kalah dari pembatalan pelanggan gagal tanpa mengubah apa pun", async () => {
      const a = await createInvoice("GWF-T9A", PRICE);
      const b = await createInvoice("GWF-T9B", PRICE);
      await payFromPortal([a.id, b.id], MANUAL_METHOD);
      const ids = [
        (await paymentsOf(a.id))[0].id,
        (await paymentsOf(b.id))[0].id,
      ];

      let lockHeld!: () => void;
      let releaseCustomer!: () => void;
      const locked = new Promise<void>((resolve) => (lockHeld = resolve));
      const customerMayCommit = new Promise<void>(
        (resolve) => (releaseCustomer = resolve),
      );
      const customerCancel = prismaBillingAuth.$transaction(
        async (tx) => {
          await tx.payment.updateMany({
            where: { id: { in: ids } },
            data: { gatewayStatus: "CANCELLED" },
          });
          lockHeld();
          await customerMayCommit;
        },
        { timeout: 30_000 },
      );
      await locked;

      const approval = asTenant(() =>
        new ManualPaymentAdminRouteService().verifyManualPayment({
          paymentId: ids[0],
          action: "APPROVE",
        }),
      ).then(
        () => ({ status: 200, message: "" }),
        (error: { status?: number; message: string }) => ({
          status: error.status,
          message: error.message,
        }),
      );
      await waitForBlockedPaymentUpdate();
      releaseCustomer();
      await customerCancel;

      const rows = await prismaBillingAuth.payment.findMany({
        where: { id: { in: ids } },
        select: { gatewayStatus: true, verifiedAt: true },
      });
      expect({
        approval: await approval,
        rows: rows.map((p) => [p.gatewayStatus, p.verifiedAt]),
        invoices: [(await invoice(a.id)).status, (await invoice(b.id)).status],
      }).toEqual({
        approval: {
          status: 409,
          message: expect.stringMatching(/dibatalkan pelanggan/),
        },
        rows: [
          ["CANCELLED", null],
          ["CANCELLED", null],
        ],
        invoices: ["SENT", "SENT"],
      });
    });

    it("kupon yang sudah melunasi invoice Rp 0 di checkout itu tidak dilepas saat sisanya dibatalkan", async () => {
      await createCoupon(1);
      const small = await createInvoice(
        "GWF-T6A",
        DISCOUNT,
        new Date("2026-10-01T03:00:00.000Z"),
      );
      const big = await createInvoice("GWF-T6B", PRICE);
      await payFromPortal([small.id, big.id], MANUAL_METHOD, COUPON_CODE);

      await asTenant(() =>
        cancelCustomerManualCheckout({
          customerId: PELANGGAN,
          invoiceId: big.id,
        }),
      );

      expect({
        smallRow: (await paymentsOf(small.id))[0].gatewayStatus,
        bigRow: (await paymentsOf(big.id))[0].gatewayStatus,
        couponUsedCount: await couponUsedCount(),
      }).toEqual({ smallRow: "PAID", bigRow: "CANCELLED", couponUsedCount: 1 });
    });
  });
});

/** Tunggu sampai UPDATE payment pelanggan tertahan kunci baris transaksi lain. */
async function waitForBlockedPaymentUpdate() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prismaBillingAuth.$queryRaw<
      Array<{ waiting: bigint }>
    >`SELECT count(*) AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query ILIKE '%UPDATE%"Payment"%'`;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("UPDATE pembatalan tidak pernah menunggu kunci admin");
}
