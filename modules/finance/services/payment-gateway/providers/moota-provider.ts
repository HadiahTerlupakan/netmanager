import { logger } from "@/lib/logger";
import * as crypto from "crypto";
import { timingSafeCompare } from "./signature-compare.helpers";
import type {
  PaymentProvider,
  ProviderConfig,
  CreatePaymentParams,
  PaymentResult,
  TransactionStatus,
  WebhookResult,
  TestResult,
} from "../provider-interface";

export class MootaProvider implements PaymentProvider {
  name = "MOOTA";
  private apiKey: string = "";
  private apiSecret: string = ""; // Digunakan sebagai webhook secret di Moota jika ada

  // Base URL untuk API Moota V2
  private baseUrl = "https://app.moota.co/api/v2";

  initialize(config: ProviderConfig): void {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret || "";
  }

  private getHeaders() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      // Karena Moota adalah layanan cek mutasi (bukan VA/QRIS gateway langsung),
      // kita mensimulasikan pembuatan "instruksi pembayaran" dengan nominal unik.

      // Generate nominal unik (misal: tambah 1-999 rupiah di akhir)
      // Di implementasi aslinya, mungkin butuh logic untuk cek nominal unik yang belum terpakai di database
      // Untuk sementara, kita buat simple random (atau rely on logic sebelum provider dipanggil)

      // Catatan: Idealnya backend aplikasi (misal: endpoint create payments) yang men-generate angka unik
      // lalu meneruskannya ke params.amount ini.

      return {
        success: true,
        transactionId: params.orderId, // Gunakan orderId sebagai referensi internal
        // Kita tidak mendapatkan paymentUrl dari Moota karena transfer dilakukan manual ke rekening yang kita tentukan
        // Oleh karena itu paymentUrl kita kosongkan atau bisa arahkan ke halaman instruksi pembayaran lokal di frontend
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        error: err.message || "Gagal membuat metode pembayaran Moota",
      };
    }
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    // Moota berbasis push notification (Webhook)
    // Mengecek status by orderId ke Moota mungkin tidak selalu direct, tapi kita bisa cek list mutasi jika diperlukan
    // Untuk sekarang kita return pending as default karena sistem bergantung penuh pada webhook Moota
    return {
      orderId,
      status: "PENDING",
    };
  }

  async cancelPayment(_orderId: string): Promise<void> {
    // Transfer manual tidak memiliki endpoint pembatalan di Moota
    return Promise.resolve();
  }

  verifyWebhook(
    _payload: unknown,
    signature?: string,
    rawBody?: string,
  ): boolean {
    // Moota menyediakan Signature di header untuk HMAC SHA-256
    if (!this.apiSecret) return true; // Jika tidak dikonfigurasi, skip verifikasi

    if (!signature || !rawBody) return false;

    try {
      // Validasi HMAC SHA-256 dari payload mentah menggunakan kunci rahasia
      const hash = crypto
        .createHmac("sha256", this.apiSecret)
        .update(rawBody)
        .digest("hex");

      return timingSafeCompare(hash, signature);
    } catch (error) {
      logger.error("[Moota Provider] Signature verification error:", error);
      return false;
    }
  }

  async processWebhook(payload: unknown): Promise<WebhookResult> {
    try {
      // Payload dari Moota API V2 Webhook biasanya berupa list mutasi (array)
      // Struktur: [{ "mutation_id": "xxx", "bank_id": "xxx", "amount": 150123, "description": "xxx", "type": "CR", ... }]

      const payloadRecord = payload as Record<string, unknown>;
      const mutations = Array.isArray(payload)
        ? payload
        : Array.isArray(payloadRecord?.data)
          ? payloadRecord.data
          : [];

      // Karena satu webhook bisa berisi banyak mutasi, kita harus handle di luar provider-interface standard
      // (yang berasumsi 1 webhook = 1 orderId).
      // Namun untuk memenuhi interface, kita mengasumsikan ini dipanggil per-mutasi atau di-loop di luar.

      // Untuk kesederhanaan, kita ambil mutasi pertama jika payload adalah array (Hanya contoh implementasi)
      const mutation =
        Array.isArray(mutations) && mutations.length > 0
          ? mutations[0]
          : payload;

      // Kita harus mencari orderId berdasarkan amount (karena Moota tidak tahu orderId kita)
      // Hal ini tidak bisa dilakukan murni di dalam Provider karena butuh akses database.
      // Oleh karena itu, kita mengembalikan struct dengan amount, dan GatewayManager yang akan mencari Order/Payment terkait.

      return {
        orderId: "", // Dikosongkan, GatewayManager harus mencari berdasarkan amount
        status: mutation.type === "CR" ? "PAID" : "PENDING", // CR = Credit / Uang Masuk
        paidAt: mutation.date ? new Date(mutation.date) : new Date(),
        paymentMethod: "BANK_TRANSFER",
        transactionId: mutation.mutation_id as string,
        amount: Number(mutation.amount),
        raw: mutation,
      };
    } catch (error) {
      logger.error("[Moota Provider] Error processing webhook:", error);
      return {
        orderId: "",
        status: "FAILED",
        raw: payload,
      };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      // Endpoint untuk cek profil atau list bank di Moota API V2
      const response = await fetch(`${this.baseUrl}/profile`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: "Koneksi ke Moota API berhasil",
          details: data,
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          message: `Gagal terhubung ke Moota API: ${response.status} ${response.statusText}`,
          details: { error: text },
        };
      }
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        message: err.message || "Gagal terhubung ke Moota API",
      };
    }
  }
}
