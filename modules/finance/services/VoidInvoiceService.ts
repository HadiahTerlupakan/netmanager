import type { InvoiceWithPayment } from "../domain/ports/IInvoiceRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { closeAbandonedManualTransfers } from "./abandoned-manual-transfer";
import { runAdminActionUnderCustomerCheckoutLock } from "./customer-checkout-lock";
import { reverseJournalsOfCancelledInvoice } from "./invoice-cancellation-journals";
import { refundSaldoKreditUsedBy } from "./outstanding-invoice.helpers";
import type { PelangganBillingBridgeService } from "@/modules/pelanggan";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import { CustomerEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";

export class VoidInvoiceService {
  private invoiceRepo: InvoiceRepository;
  private pelangganBridge: PelangganBillingBridgeService;

  constructor() {
    this.invoiceRepo = new InvoiceRepository();
    this.pelangganBridge = getPelangganBillingBridge();
  }

  static async voidInvoice(
    invoiceId: string,
    reason: string,
    adminUserId: string,
    allowedSiteIds?: string[],
  ) {
    const service = new VoidInvoiceService();
    return service.executeVoid(invoiceId, reason, adminUserId, allowedSiteIds);
  }

  private async executeVoid(
    invoiceId: string,
    reason: string,
    adminUserId: string,
    allowedSiteIds?: string[],
  ) {
    try {
      const invoice = await this.invoiceRepo.findUnique(invoiceId);

      if (!invoice) throw new Error("NOT_FOUND: Invoice tidak ditemukan");

      if (invoice.status !== "PAID" && invoice.status !== "PARTIAL_PAID") {
        throw new Error(
          "FORBIDDEN: Hanya invoice PAID atau PARTIAL_PAID yang dapat dibatalkan melalui fitur ini",
        );
      }

      // Scope validation
      if (allowedSiteIds && allowedSiteIds.length > 0) {
        const pelanggan = await this.pelangganBridge.findById(
          invoice.pelangganId,
        );
        if (
          !pelanggan ||
          !pelanggan.siteId ||
          !allowedSiteIds.includes(pelanggan.siteId)
        ) {
          throw new Error(
            "FORBIDDEN: Anda tidak dapat membatalkan invoice untuk pelanggan di luar scope Anda",
          );
        }
      }

      await runAdminActionUnderCustomerCheckoutLock(
        invoice.pelangganId,
        "void-invoice",
        () => this.voidUnderCheckoutLock(invoice, reason, adminUserId),
      );

      const pelanggan = await this.pelangganBridge.findById(
        invoice.pelangganId,
      );

      if (!pelanggan) {
        logger.warn(
          `[VoidInvoiceService] Pelanggan ${invoice.pelangganId} not found in main DB for invoice ${invoiceId}`,
        );
        return {
          success: true,
          data: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            pelangganId: invoice.pelangganId,
            previousStatus: invoice.status,
            newStatus: "CANCELLED",
            customerUpdateSkipped: true,
          },
        };
      }

      const currentJatuhTempo = pelanggan.jatuhTempo;
      const newJatuhTempo = new Date(currentJatuhTempo);
      newJatuhTempo.setMonth(newJatuhTempo.getMonth() - 1);

      const statusChanged = pelanggan.status === "AKTIF";

      await this.pelangganBridge.update(pelanggan.id, {
        jatuhTempo: newJatuhTempo,
      });

      if (statusChanged) {
        try {
          await CustomerEventDispatcher.onIsolated({
            customerId: pelanggan.id,
            customerName: pelanggan.nama ?? pelanggan.id,
            oldStatus: pelanggan.status,
            newStatus: "ISOLIR",
            tenantId: pelanggan.tenantId ?? undefined,
          });
        } catch (radiusErr) {
          logger.error(
            "[VoidInvoiceService] Failed to emit CUSTOMER_ISOLATED event:",
            radiusErr,
          );
        }
      }

      await logger.logActivity({
        action: "VOID_INVOICE",
        subject: `Invoice ${invoice.invoiceNumber}`,
        details: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          pelangganId: invoice.pelangganId,
          totalAmount: Number(invoice.totalAmount),
          reason,
          voidedBy: adminUserId,
          previousStatus: invoice.status,
          jatuhTempoOld: currentJatuhTempo,
          jatuhTempoNew: newJatuhTempo,
          customerStatusChanged: statusChanged ? "AKTIF → ISOLIR" : "unchanged",
        },
      });

      return {
        success: true,
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          pelangganId: invoice.pelangganId,
          previousStatus: invoice.status,
          newStatus: "CANCELLED",
          jatuhTempoOld: currentJatuhTempo,
          jatuhTempoNew: newJatuhTempo,
          customerStatusChanged: statusChanged,
        },
      };
    } catch (error: unknown) {
      logger.error("[VoidInvoiceService] Fatal error:", error);
      throw error;
    }
  }

  /**
   * Di bawah kunci checkout pelanggan: pelanggan tidak bisa membuat VA untuk
   * sisa tagihan yang sedang di-void. Hanya void yang memindahkan statusnya
   * yang mengembalikan saldo kredit dan melanjutkan ke jatuh tempo; void kedua
   * yang bersamaan (klik ganda) ditolak.
   */
  private async voidUnderCheckoutLock(
    invoice: InvoiceWithPayment,
    reason: string,
    adminUserId: string,
  ) {
    const isVoided = await this.invoiceRepo.voidInvoiceTransaction(
      invoice.id,
      reason,
      invoice.notes,
    );
    if (!isVoided) {
      throw new Error(
        `CONFLICT: Tagihan ${invoice.invoiceNumber} baru saja diubah atau dibatalkan admin lain; muat ulang halaman.`,
      );
    }
    await refundSaldoKreditUsedBy(invoice);
    await reverseJournalsOfCancelledInvoice({
      invoiceId: invoice.id,
      reason: `Tagihan dibatalkan: ${reason}`,
      reversedBy: adminUserId,
    });
    const { cancelInvoiceBillingSchedules } =
      await import("./billingScheduleLifecycle");
    await cancelInvoiceBillingSchedules(invoice.id);
    await this.closeAbandonedTransfers(invoice.id);
  }

  /**
   * Transfer manual tanpa bukti untuk tagihan yang dibatalkan tidak punya
   * jalan keluar. Kegagalannya hanya dicatat: pembatalannya sudah tersimpan
   * dan tidak bisa diulang, sedangkan jatuh tempo pelanggan tetap harus
   * dikembalikan.
   */
  private async closeAbandonedTransfers(invoiceId: string) {
    try {
      await closeAbandonedManualTransfers(invoiceId);
    } catch (error) {
      logger.error(
        `[VoidInvoiceService] Transfer manual tanpa bukti untuk invoice ${invoiceId} gagal ditutup:`,
        error,
      );
    }
  }
}
