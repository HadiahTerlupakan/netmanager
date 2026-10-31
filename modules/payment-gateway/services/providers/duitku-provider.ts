import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/utils/env";
import { getCustomerPortalBillingUrl } from "@/lib/utils/portal-url";
import { fetchWithTimeout } from "./fetch-with-timeout";
import {
  GatewayTransactionNotFoundError,
  type CreatePaymentParams,
  type PaymentProvider,
  type PaymentResult,
  type ProviderConfig,
  type StatusCheckOptions,
  type TestResult,
  type TransactionStatus,
  type WebhookResult,
} from "../provider-interface";
import {
  buildDuitkuTestResult,
  buildDuitkuWebhookResult,
  createDuitkuInvoiceSignatures,
  createDuitkuPaymentMethodSignatures,
  createDuitkuStatusSignatures,
  createDuitkuWebhookSignatures,
  formatDuitkuDatetime,
  mapDuitkuStatus,
} from "./duitku-provider-helpers";
import { resolveDuitkuExpiryMinutes } from "./duitku-expiry";
import { timingSafeCompare } from "./signature-compare.helpers";

// Batas panjang customerVaName di API Duitku.
const VA_NAME_MAX_LENGTH = 20;
const MINUTE_MS = 60 * 1000;
// Satu panggilan Duitku, termasuk percobaan ulang tanda tangan lama, selesai
// dalam batas ini; kunci checkout menghitung waktunya dari sini.
export const DUITKU_REQUEST_TIMEOUT_MS = 30_000;
// Daftar kanal dibaca saat pelanggan membuka pilihan metode: Duitku yang
// lambat tidak boleh menahan halaman, katalog statis dipakai sebagai gantinya.
const PAYMENT_METHOD_LIST_TIMEOUT_MS = 5_000;
const KNOWN_STATUS_CODES = new Set(["00", "01", "02", "03"]);

type DuitkuInquiryResponse = {
  statusCode?: string;
  statusMessage?: string;
  responseCode?: string;
  responseMessage?: string;
  Message?: string;
  paymentUrl?: string;
  vaNumber?: string;
  qrString?: string;
  reference?: string;
  raw?: string;
};

type DuitkuStatusResponse = {
  settlementDate?: string;
  paymentCode?: string;
  paymentMethod?: string;
  amount?: number | string;
  fee?: number | string;
};

type DuitkuPaymentMethodResponse = {
  paymentFee?: Array<{ paymentMethod?: string }>;
};

// Error Duitku tidak selalu JSON berisi statusMessage: penolakan (misalnya
// nominal di bawah minimum, merchant tidak dikenal) datang sebagai HTTP 4xx
// dengan `Message` atau teks biasa.
async function readDuitkuResponse<T>(response: {
  text: () => Promise<string>;
}): Promise<T & { raw?: string }> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { raw } as T & { raw?: string };
  }
}

const WRONG_SIGNATURE = /wrong signature/i;
const TRANSACTION_NOT_FOUND = /transaction not found/i;

function describeResult(result: DuitkuInquiryResponse) {
  return (
    result.statusMessage ||
    result.responseMessage ||
    result.Message ||
    result.raw?.slice(0, 200)
  );
}

function isWrongSignature(result: DuitkuInquiryResponse) {
  return WRONG_SIGNATURE.test(describeResult(result) || "");
}

/**
 * POST ke Duitku, mengulang dengan tanda tangan berikutnya bila ditolak.
 * Seluruh percobaan berbagi satu batas waktu: percobaan ulang hanya mendapat
 * sisanya.
 */
async function postSigned<T>(
  url: string,
  body: Record<string, unknown>,
  signatures: string[],
  timeoutMs = DUITKU_REQUEST_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeoutMs;
  let attempt!: { status: number; result: T & DuitkuInquiryResponse };
  for (const signature of signatures) {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, signature }),
      timeoutMs: Math.max(deadline - Date.now(), 0),
    });
    attempt = {
      status: response.status,
      result: await readDuitkuResponse<T & DuitkuInquiryResponse>(response),
    };
    if (!isWrongSignature(attempt.result)) break;
  }
  return attempt;
}

function describeDuitkuError(status: number, result: DuitkuInquiryResponse) {
  return `Duitku HTTP ${status}: ${describeResult(result) || "tanpa pesan"}`;
}

function toOptionalNumber(value: number | string | undefined) {
  return value === undefined ? undefined : Number(value);
}

export class DuitkuProvider implements PaymentProvider {
  name = "Duitku";
  private config?: ProviderConfig;
  private baseUrl = "";

  /** Inisialisasi config dan base URL Duitku. */
  initialize(config: ProviderConfig): void {
    this.config = config;
    this.baseUrl = config.isProduction
      ? "https://passport.duitku.com/webapi/api"
      : "https://sandbox.duitku.com/webapi/api";
  }

  /** Membuat invoice pembayaran Duitku. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const merchantOrderId = params.orderId;
      const paymentAmount = params.amount;
      const paymentMethod = params.paymentMethods?.[0] || "VC";
      const expiryMinutes = resolveDuitkuExpiryMinutes(
        paymentMethod,
        params.expiryHours ? params.expiryHours * 60 : undefined,
      );
      // Diambil sebelum permintaan: Duitku mulai menghitung saat transaksinya
      // dibuat, jadi hitung mundur portal tidak boleh berakhir lebih lambat.
      const issuedAt = Date.now();
      const requestBody = {
        merchantCode,
        paymentAmount,
        paymentMethod,
        merchantOrderId,
        productDetails: params.description,
        merchantUserInfo: params.customerName,
        customerVaName: params.customerName.slice(0, VA_NAME_MAX_LENGTH),
        email: params.customerEmail,
        phoneNumber: params.customerPhone,
        callbackUrl: `${getAppUrl()}/api/webhooks/duitku`,
        returnUrl: params.returnUrl ?? getCustomerPortalBillingUrl(),
        expiryPeriod: expiryMinutes,
      };
      const { status, result } = await postSigned<DuitkuInquiryResponse>(
        // createinvoice adalah endpoint API POP di host lain (dengan header
        // tanda tangan sendiri); di webapi pembuatan transaksi lewat v2/inquiry.
        `${this.baseUrl}/merchant/v2/inquiry`,
        requestBody,
        createDuitkuInvoiceSignatures({
          merchantCode,
          merchantOrderId,
          paymentAmount,
          apiKey: config.apiKey,
        }),
      );

      if (result.statusCode !== "00") {
        return {
          success: false,
          error: describeDuitkuError(status, result),
        };
      }

      return {
        success: true,
        paymentUrl: result.paymentUrl,
        vaNumber: result.vaNumber,
        qrString: result.qrString,
        transactionId: result.reference,
        expiresAt: new Date(issuedAt + expiryMinutes * MINUTE_MS),
      };
    } catch (error: unknown) {
      logger.error("Duitku createPayment error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
      };
    }
  }

  /**
   * Mengecek status transaksi Duitku. Jawaban tanpa status yang dikenal
   * (order tidak ditemukan, merchant salah, galat server) dilempar, bukan
   * dianggap gagal: pemanggil tidak boleh menutup checkout atas dasar itu.
   */
  async checkStatus(
    orderId: string,
    options: StatusCheckOptions = {},
  ): Promise<TransactionStatus> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const { status: httpStatus, result } =
        await postSigned<DuitkuStatusResponse>(
          `${this.baseUrl}/merchant/transactionStatus`,
          { merchantCode, merchantOrderId: orderId },
          createDuitkuStatusSignatures({
            merchantCode,
            merchantOrderId: orderId,
            apiKey: config.apiKey,
          }),
          options.timeoutMs,
        );
      if (!result.statusCode || !KNOWN_STATUS_CODES.has(result.statusCode)) {
        const message = describeDuitkuError(httpStatus, result);
        throw TRANSACTION_NOT_FOUND.test(describeResult(result) || "")
          ? new GatewayTransactionNotFoundError(message)
          : new Error(message);
      }
      const status = mapDuitkuStatus(result.statusCode);
      const fee = toOptionalNumber(result.fee);

      return {
        orderId,
        status,
        ...(status === "PAID"
          ? {
              paidAt: result.settlementDate
                ? new Date(result.settlementDate)
                : new Date(),
            }
          : {}),
        paymentMethod: result.paymentCode || result.paymentMethod,
        amount: toOptionalNumber(result.amount),
        transactionId: result.reference,
        // Duitku hanya melaporkan biaya di cek status, tidak di callback.
        ...(fee !== undefined ? { fee } : {}),
      };
    } catch (error: unknown) {
      logger.error("Duitku checkStatus error:", error);
      throw error;
    }
  }

  /** Kode kanal yang aktif untuk merchant ini pada nominal tertentu. */
  async getActivePaymentMethods(amount: number): Promise<string[]> {
    const config = this.requireConfig();
    const merchantCode = config.merchantId || "";
    const datetime = formatDuitkuDatetime(new Date());
    const { status, result } = await postSigned<DuitkuPaymentMethodResponse>(
      `${this.baseUrl}/merchant/paymentmethod/getpaymentmethod`,
      { merchantcode: merchantCode, amount, datetime },
      createDuitkuPaymentMethodSignatures({
        merchantCode,
        amount,
        datetime,
        apiKey: config.apiKey,
      }),
      PAYMENT_METHOD_LIST_TIMEOUT_MS,
    );
    if (result.responseCode !== "00" || !Array.isArray(result.paymentFee)) {
      throw new Error(describeDuitkuError(status, result));
    }

    return result.paymentFee.flatMap((fee) =>
      fee.paymentMethod ? [fee.paymentMethod] : [],
    );
  }

  /** Membiarkan transaksi Duitku expired otomatis. */
  async cancelPayment(_orderId: string): Promise<void> {}

  /** Memverifikasi signature webhook Duitku. */
  verifyWebhook(payload: unknown, _signature?: string): boolean {
    try {
      const config = this.config;
      if (!config || !this.isRecord(payload)) {
        return false;
      }

      return this.verifyDuitkuSignature(payload, config);
    } catch (error) {
      logger.error("Duitku webhook verification error:", error);
      return false;
    }
  }

  private verifyDuitkuSignature(
    payload: Record<string, unknown>,
    config: { merchantId?: string; apiKey: string },
  ) {
    const merchantCode = config.merchantId || "";
    const signature = payload.signature as string;
    return createDuitkuWebhookSignatures({
      merchantCode,
      merchantOrderId: payload.merchantOrderId as string,
      amount: payload.amount as string,
      apiKey: config.apiKey,
    }).some((expected) => timingSafeCompare(signature, expected));
  }

  /** Menormalkan payload webhook Duitku. */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    if (!this.isRecord(payload)) {
      throw new Error("Invalid Duitku webhook payload");
    }

    try {
      return buildDuitkuWebhookResult(payload);
    } catch (error: unknown) {
      logger.error("Duitku processWebhook error:", error);
      throw error;
    }
  }

  /** Mengetes koneksi credential Duitku. */
  async testConnection(): Promise<TestResult> {
    try {
      const config = this.requireConfig();
      const merchantCode = config.merchantId || "";
      const testOrderId = `TEST-${Date.now()}`;
      const { status, result } = await postSigned<DuitkuInquiryResponse>(
        `${this.baseUrl}/merchant/transactionStatus`,
        { merchantCode, merchantOrderId: testOrderId },
        createDuitkuStatusSignatures({
          merchantCode,
          merchantOrderId: testOrderId,
          apiKey: config.apiKey,
        }),
      );

      // Order uji memang tidak ada: Duitku baru menjawab "Transaction not
      // found" setelah merchant dan tanda tangannya lolos. "Wrong signature"
      // atau "Merchant not found" berarti kredensialnya salah.
      if (
        result.statusCode ||
        TRANSACTION_NOT_FOUND.test(result.Message || "")
      ) {
        return buildDuitkuTestResult(config);
      }

      return { success: false, message: describeDuitkuError(status, result) };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Koneksi gagal",
        details: {
          error: (error as Record<string, unknown>)?.code,
        },
      };
    }
  }

  /** Memastikan provider Duitku sudah diinisialisasi. */
  private requireConfig() {
    if (!this.config) {
      throw new Error("Duitku not initialized");
    }

    return this.config;
  }

  /** Memastikan payload webhook berbentuk object. */
  private isRecord(payload: unknown): payload is Record<string, unknown> {
    return typeof payload === "object" && payload !== null;
  }
}
