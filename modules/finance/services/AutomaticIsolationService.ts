import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { AttendanceSettingsService } from "@/modules/attendance/services/AttendanceSettingsService";
import { logger } from "@/lib/logger";
import { Status } from "@prisma/client";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { notifyCustomerFinanceNotification } from "../utils/customerFinanceNotifications";
import {
  getPelangganService,
  PelangganBillingBridgeService,
} from "@/modules/pelanggan";

export class AutomaticIsolationService {
  static async runDailyCheck() {
    try {
      const settingsRepo = new AttendanceSettingsService();
      const billingRepo = new InvoiceRepository();
      const pelangganBridge = new PelangganBillingBridgeService();

      const enabledSetting = await settingsRepo.findByKey(
        "GENERAL_AUTO_ISOLASI_ENABLED",
      );
      const isEnabled = enabledSetting?.value !== "false";

      if (!isEnabled) {
        return;
      }

      const today = new Date();
      today.setTime(toStartOfDay(today).getTime());

      const overdueInvoices = await billingRepo.findOverdueInvoices(today);

      const activeCustomersMap = new Map();
      for (const inv of overdueInvoices) {
        const pelanggan = await pelangganBridge.findById(inv.pelangganId);
        if (pelanggan && pelanggan.status === "AKTIF" && pelanggan.autoIsolir) {
          activeCustomersMap.set(pelanggan.id, pelanggan);
        }
      }
      const activeCustomers = Array.from(activeCustomersMap.values());

      for (const customer of activeCustomers) {
        try {
          const dueDate = new Date(customer.jatuhTempo);
          dueDate.setTime(toStartOfDay(dueDate).getTime());

          const diffTime = Math.abs(today.getTime() - dueDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          await getPelangganService().updateStatusPelanggan(
            customer.id,
            Status.ISOLIR,
          );

          await notifyCustomerFinanceNotification({
            userId: customer.userId,
            title: "Layanan Diisolir",
            message:
              "Layanan internet Anda telah diisolir karena melewati batas pembayaran. Mohon segera lakukan pembayaran.",
            link: "/tagihan",
            sourceType: "BILLING",
            sourceId: customer.id,
            priority: "HIGH",
          });

          await logger.logActivity({
            action: "UPDATE",
            subject: "Pelanggan (Auto Isolir)",
            details: {
              id: customer.id,
              name: customer.nama,
              reason: `Overdue ${diffDays} days`,
            },
          });
        } catch (err) {
          logger.error(
            `[AutoIsolation] Error isolating customer ${customer.id}:`,
            err,
          );
        }
      }
    } catch (error) {
      logger.error("[AutoIsolation] Fatal error:", error);
      logger.error(error);
    }
  }
}
