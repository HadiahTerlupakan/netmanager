import { logger } from "@/lib/logger";
import { EmailService } from "@/modules/notification";
import type { InventoryRepository } from "../repositories/InventoryRepository";

type RestockSetting = Awaited<
  ReturnType<InventoryRepository["findActiveRestockSettings"]>
>[number];
type RestockRecipient = Awaited<
  ReturnType<InventoryRepository["findRestockNotificationRecipients"]>
>[number];
type AlertDecision = NonNullable<ReturnType<typeof buildAlertDecision>>;

export async function processRestockSetting(input: {
  repository: InventoryRepository;
  setting: RestockSetting;
  recipients: RestockRecipient[];
  emailService: EmailService;
}) {
  const currentStock = await input.repository.findBarangGudangStock(
    input.setting.barangId,
    input.setting.gudangId,
  );
  if (!currentStock) return { created: false, notificationsSent: 0 };

  const alert = buildAlertDecision(input.setting, currentStock.stok);
  if (!alert) return { created: false, notificationsSent: 0 };

  const existingAlert = await input.repository.findOpenRestockAlert({
    barangId: input.setting.barangId,
    gudangId: input.setting.gudangId,
    alertType: alert.alertType,
  });
  if (existingAlert) return { created: false, notificationsSent: 0 };

  const recommendedOrder = Math.max(
    0,
    input.setting.maxStok - currentStock.stok,
  );
  const alertId = crypto.randomUUID();
  const newAlert = await createRestockAlert(input, {
    alert,
    alertId,
    currentStock: currentStock.stok,
    recommendedOrder,
  });
  const notificationsSent = await notifyRestockRecipients(input, {
    alert,
    alertId,
    currentStock: currentStock.stok,
    recommendedOrder,
  });

  return { created: true, alert: newAlert, notificationsSent };
}

export function buildAlertDecision(
  setting: {
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
    minStok: number;
    maxStok: number;
  },
  currentStock: number,
) {
  if (currentStock === 0) return createStockOutDecision(setting);
  if (currentStock <= setting.minStok) {
    return createLowStockDecision(setting, currentStock);
  }
  if (currentStock > setting.maxStok) {
    return {
      alertType: "OVERSTOCK" as const,
      urgency: "LOW" as const,
      message: `Stok berlebih! ${setting.barang.nama} di ${setting.gudang.nama} sebanyak ${currentStock} ${setting.barang.satuan} (max: ${setting.maxStok})`,
    };
  }
  return null;
}

async function createRestockAlert(
  input: {
    repository: InventoryRepository;
    setting: RestockSetting;
  },
  alertInput: {
    alert: AlertDecision;
    alertId: string;
    currentStock: number;
    recommendedOrder: number;
  },
) {
  return input.repository.createRestockAlert({
    id: alertInput.alertId,
    barangId: input.setting.barangId,
    gudangId: input.setting.gudangId,
    alertType: alertInput.alert.alertType,
    currentStok: alertInput.currentStock,
    minStok: input.setting.minStok,
    recommendedOrder: alertInput.recommendedOrder,
    urgency: alertInput.alert.urgency,
    message: alertInput.alert.message,
  });
}

async function notifyRestockRecipients(
  input: {
    repository: InventoryRepository;
    setting: RestockSetting;
    recipients: RestockRecipient[];
    emailService: EmailService;
  },
  alertInput: {
    alert: AlertDecision;
    alertId: string;
    currentStock: number;
    recommendedOrder: number;
  },
) {
  if (!shouldNotify(alertInput.alert)) return 0;
  const notificationsSent = await createRestockNotifications(input, alertInput);
  if (alertInput.alert.urgency === "CRITICAL") {
    await sendCriticalStockEmails(input, alertInput);
  }
  return notificationsSent;
}

async function createRestockNotifications(
  input: {
    repository: InventoryRepository;
    setting: RestockSetting;
    recipients: RestockRecipient[];
  },
  alertInput: { alert: AlertDecision; alertId: string },
) {
  const notificationData = input.recipients.map((recipient) => ({
    id: crypto.randomUUID(),
    type: "ALERT" as const,
    priority:
      alertInput.alert.urgency === "CRITICAL"
        ? ("HIGH" as const)
        : ("NORMAL" as const),
    title:
      alertInput.alert.urgency === "CRITICAL" ? "STOK HABIS" : "Stok Menipis",
    message: alertInput.alert.message,
    userId: recipient.id,
    sourceType: "INVENTORY",
    link: "/admin/inventory/restock",
    sourceId: alertInput.alertId,
    tenantId: input.setting.tenantId,
  }));

  if (notificationData.length === 0) return 0;
  await input.repository.createNotifications(notificationData);
  return notificationData.length;
}

async function sendCriticalStockEmails(
  input: {
    setting: RestockSetting;
    recipients: RestockRecipient[];
    emailService: EmailService;
  },
  alertInput: { currentStock: number; recommendedOrder: number },
) {
  await Promise.all(
    input.recipients
      .filter((recipient) => recipient.email)
      .map((recipient) =>
        input.emailService
          .sendEmail({
            to: recipient.email!,
            subject: `[CRITICAL] Stock Alert: ${input.setting.barang.nama}`,
            html: buildCriticalStockEmail(input.setting, alertInput),
          })
          .catch((error) =>
            logger.error(`Failed to send email to ${recipient.email}`, error),
          ),
      ),
  );
}

function shouldNotify(alert: AlertDecision) {
  return alert.urgency === "CRITICAL" || alert.urgency === "HIGH";
}

function createStockOutDecision(
  setting: Parameters<typeof buildAlertDecision>[0],
) {
  return {
    alertType: "STOCK_OUT" as const,
    urgency: "CRITICAL" as const,
    message: `STOK HABIS! ${setting.barang.nama} di ${setting.gudang.nama} kosong`,
  };
}

function createLowStockDecision(
  setting: Parameters<typeof buildAlertDecision>[0],
  currentStock: number,
) {
  return {
    alertType: "LOW_STOCK" as const,
    urgency:
      currentStock <= setting.minStok * 0.5
        ? ("HIGH" as const)
        : ("MEDIUM" as const),
    message: `Stok rendah! ${setting.barang.nama} di ${setting.gudang.nama} tersisa ${currentStock} ${setting.barang.satuan} (min: ${setting.minStok})`,
  };
}

function buildCriticalStockEmail(
  setting: RestockSetting,
  input: { currentStock: number; recommendedOrder: number },
) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #dc2626;">Stok Habis: ${setting.barang.nama}</h2>
      <p>Barang <strong>${setting.barang.nama}</strong> di gudang <strong>${setting.gudang.nama}</strong> telah habis.</p>
      <div style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${input.currentStock} ${setting.barang.satuan}</p>
        <p style="margin: 5px 0;"><strong>Min Stock:</strong> ${setting.minStok}</p>
        <p style="margin: 5px 0;"><strong>Recommended Order:</strong> ${input.recommendedOrder}</p>
      </div>
      <p>Mohon segera lakukan restock atau buat Purchase Request melalui dashboard.</p>
      <a href="${process.env.NEXTAUTH_URL}/admin/inventory/restock" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Buka Dashboard Restock</a>
    </div>
  `;
}
