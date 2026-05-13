import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceSettingsService } from "@/modules/attendance";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

const REMINDER_BATCH_SIZE = 50;

export class BillingReminderService {
  constructor(
    private readonly invoiceRepo = new InvoiceRepository(),
    private readonly settingsRepo = new AttendanceSettingsService(),
  ) {}

  /** Send payment reminders for unpaid invoices based on settings. */
  async sendDailyReminders() {
    try {
      const settingsMap = await this.getReminderSettings();
      if (!this.isReminderTime(settingsMap)) return;
      if (settingsMap.get("GENERAL_NOTIF_APP") === "false") return;

      logger.info("[Billing] Starting daily reminders check...");
      const unpaidInvoices = await this.findReminderInvoices(settingsMap);
      if (unpaidInvoices.length === 0) return;

      logger.info(
        `[Billing] Found ${unpaidInvoices.length} invoices to remind.`,
      );
      await this.sendReminderBatches(unpaidInvoices);
      logger.info("[Billing] Daily reminders check completed.");
    } catch (error) {
      logger.error("[Billing] Error in sendDailyReminders:", error);
    }
  }

  private async getReminderSettings() {
    const settings = await this.settingsRepo.findManyByKeys([
      "GENERAL_REMINDER_OTOMATIS",
      "GENERAL_REMINDER_FREQUENCY",
      "GENERAL_REMINDER_TIME",
      "GENERAL_NOTIF_APP",
    ]);

    return new Map(settings.map((setting) => [setting.key, setting.value]));
  }

  private isReminderTime(settingsMap: Map<string, string>) {
    const reminderTime = settingsMap.get("GENERAL_REMINDER_TIME") || "08:00";
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");

    return `${currentHour}:${currentMinute}` === reminderTime;
  }

  private async findReminderInvoices(settingsMap: Map<string, string>) {
    const reminderDays = parseInt(
      settingsMap.get("GENERAL_REMINDER_OTOMATIS") || "3",
    );
    const reminderFrequency =
      settingsMap.get("GENERAL_REMINDER_FREQUENCY") || "DAILY";
    const today = new Date();
    today.setTime(toStartOfDay(today).getTime());

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + reminderDays);

    return this.invoiceRepo.findUnpaidInvoices(
      {
        status: { in: ["SENT", "PARTIAL_PAID"] },
        dueDate: this.buildDueDateFilter(today, targetDate, reminderFrequency),
      },
      {
        id: true,
        pelangganId: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        invoiceNumber: true,
        tenantId: true,
      },
    );
  }

  private buildDueDateFilter(
    today: Date,
    targetDate: Date,
    reminderFrequency: string,
  ) {
    const start = reminderFrequency === "ONCE" ? targetDate : today;
    return {
      gte: new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        0,
        0,
        0,
      ),
      lte: new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23,
        59,
        59,
      ),
    };
  }

  private async sendReminderBatches(
    unpaidInvoices: Array<{
      id: string;
      pelangganId: string;
      dueDate: Date;
      totalAmount: bigint;
      paidAmount: bigint;
      invoiceNumber: string;
      tenantId: string | null;
    }>,
  ) {
    for (let i = 0; i < unpaidInvoices.length; i += REMINDER_BATCH_SIZE) {
      const batch = unpaidInvoices.slice(i, i + REMINDER_BATCH_SIZE);
      await Promise.all(batch.map((invoice) => this.sendReminder(invoice)));
    }
  }

  private async sendReminder(invoice: {
    id: string;
    pelangganId: string;
    dueDate: Date;
    totalAmount: bigint;
    paidAmount: bigint;
    invoiceNumber: string;
    tenantId: string | null;
  }) {
    const amountDue = invoice.totalAmount - invoice.paidAmount;
    const today = new Date();
    const daysUntilDue = Math.floor(
      (invoice.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE" =
      daysUntilDue < 0
        ? "OVERDUE"
        : daysUntilDue === 0
          ? "DUE_TODAY"
          : "UPCOMING";

    try {
      const { BillingEventDispatcher } = await import("@/modules/events");
      await BillingEventDispatcher.onInvoiceReminderDue({
        invoiceId: invoice.id,
        pelangganId: invoice.pelangganId,
        invoiceNumber: invoice.invoiceNumber,
        amountDue: Number(amountDue),
        dueDate: invoice.dueDate.toLocaleDateString("id-ID"),
        reminderType,
        tenantId: invoice.tenantId ?? undefined,
      });
    } catch (error) {
      logger.error(
        `[Billing] Error emitting reminder event for invoice ${invoice.id}:`,
        error,
      );
    }
  }
}
