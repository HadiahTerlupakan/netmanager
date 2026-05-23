import { logger } from "@/lib/logger";
import { acquireCronLock } from "@/lib/cron-lock";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceSettingsService } from "@/modules/attendance";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

const REMINDER_BATCH_SIZE = 50;
const REMINDER_TIME_WINDOW_MINUTES = 5;
const REMINDER_DAY_LOCK_TTL_SECONDS = 24 * 60 * 60;

export class BillingReminderService {
  constructor(
    private readonly invoiceRepo = new InvoiceRepository(),
    private readonly settingsRepo = new AttendanceSettingsService(),
  ) {}

  /** Send payment reminders for unpaid invoices based on settings. */
  async sendDailyReminders(now: Date = new Date()) {
    try {
      const settingsMap = await this.getReminderSettings();
      if (!this.isReminderTime(settingsMap, now)) return;
      if (settingsMap.get("GENERAL_NOTIF_APP") === "false") return;

      const dayLock = await this.acquireDayLock(now);
      if (dayLock !== "acquired") {
        logger.info(
          `[Billing] Reminder skipped (${dayLock}) — already fired or lock unavailable`,
        );
        return;
      }

      logger.info("[Billing] Starting daily reminders check...");
      const unpaidInvoices = await this.findReminderInvoices(settingsMap, now);
      if (unpaidInvoices.length === 0) return;

      logger.info(
        `[Billing] Found ${unpaidInvoices.length} invoices to remind.`,
      );
      await this.sendReminderBatches(unpaidInvoices, now);
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

  /**
   * Reminder fires saat current time berada dalam window
   * `[reminderTime, reminderTime + REMINDER_TIME_WINDOW_MINUTES)`.
   * Window ini menoleransi drift cron tanpa mengorbankan presisi: lock
   * harian memastikan reminder hanya benar-benar terkirim sekali per hari.
   */
  private isReminderTime(settingsMap: Map<string, string>, now: Date) {
    const reminderTime = settingsMap.get("GENERAL_REMINDER_TIME") || "08:00";
    const targetMinutes = parseTimeOfDayToMinutes(reminderTime);
    if (targetMinutes === null) {
      logger.warn(
        `[Billing] GENERAL_REMINDER_TIME tidak valid: "${reminderTime}"`,
      );
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const delta = currentMinutes - targetMinutes;
    return delta >= 0 && delta < REMINDER_TIME_WINDOW_MINUTES;
  }

  /** Lock per hari supaya reminder tidak ter-trigger ganda dalam window. */
  private acquireDayLock(now: Date) {
    const dayKey = formatLocalDateKey(now);
    return acquireCronLock(
      `billing:reminder:daily:${dayKey}`,
      REMINDER_DAY_LOCK_TTL_SECONDS,
    );
  }

  private async findReminderInvoices(
    settingsMap: Map<string, string>,
    now: Date,
  ) {
    const reminderDays = parseInt(
      settingsMap.get("GENERAL_REMINDER_OTOMATIS") || "3",
    );
    const reminderFrequency =
      settingsMap.get("GENERAL_REMINDER_FREQUENCY") || "DAILY";
    const today = new Date(toStartOfDay(now).getTime());

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
    now: Date,
  ) {
    for (let i = 0; i < unpaidInvoices.length; i += REMINDER_BATCH_SIZE) {
      const batch = unpaidInvoices.slice(i, i + REMINDER_BATCH_SIZE);
      await Promise.all(
        batch.map((invoice) => this.sendReminder(invoice, now)),
      );
    }
  }

  private async sendReminder(
    invoice: {
      id: string;
      pelangganId: string;
      dueDate: Date;
      totalAmount: bigint;
      paidAmount: bigint;
      invoiceNumber: string;
      tenantId: string | null;
    },
    now: Date,
  ) {
    const amountDue = invoice.totalAmount - invoice.paidAmount;
    const daysUntilDue = Math.floor(
      (invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
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

/** Parse "HH:MM" jadi total menit dari midnight; return null jika invalid. */
function parseTimeOfDayToMinutes(value: string): number | null {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/** YYYY-MM-DD untuk lock key per hari di timezone server. */
function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
