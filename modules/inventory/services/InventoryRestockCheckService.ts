import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { EmailService } from "@/modules/notification";

export class InventoryRestockCheckService {
  async run() {
    const [settings, recipients] = await Promise.all([
      prisma.restockSettings.findMany({
        where: { isActive: true },
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true,
            },
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          role: {
            permission: {
              some: {
                resource: "restock",
                action: "read",
              },
            },
          },
        },
        select: { id: true, email: true },
      }),
    ]);

    const newAlerts = [];
    let notificationsSent = 0;
    const emailService = new EmailService();

    for (const setting of settings) {
      try {
        const currentStock = await prisma.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId: setting.barangId,
              gudangId: setting.gudangId,
            },
          },
        });

        if (!currentStock) {
          continue;
        }

        const alert = this.buildAlertDecision(setting, currentStock.stok);
        if (!alert) {
          continue;
        }

        const existingAlert = await prisma.restockAlerts.findFirst({
          where: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            alertType: alert.alertType,
            isResolved: false,
          },
        });

        if (existingAlert) {
          continue;
        }

        const recommendedOrder = Math.max(
          0,
          setting.maxStok - currentStock.stok,
        );
        const alertId = crypto.randomUUID();

        const newAlert = await prisma.restockAlerts.create({
          data: {
            id: alertId,
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            alertType: alert.alertType,
            currentStok: currentStock.stok,
            minStok: setting.minStok,
            recommendedOrder,
            urgency: alert.urgency,
            message: alert.message,
          },
        });
        newAlerts.push(newAlert);

        if (alert.urgency === "CRITICAL" || alert.urgency === "HIGH") {
          const notificationData = recipients.map((recipient) => ({
            id: crypto.randomUUID(),
            type: "ALERT" as const,
            priority: (alert.urgency === "CRITICAL" ? "HIGH" : "NORMAL") as
              | "HIGH"
              | "NORMAL",
            title:
              alert.urgency === "CRITICAL"
                ? "🚨 STOK HABIS"
                : "⚠️ Stok Menipis",
            message: alert.message,
            userId: recipient.id,
            sourceType: "INVENTORY",
            link: "/admin/inventory/restock",
            sourceId: alertId,
            tenantId: setting.tenantId,
          }));

          if (notificationData.length > 0) {
            await prisma.notifications.createMany({ data: notificationData });
            notificationsSent += notificationData.length;
          }

          if (alert.urgency === "CRITICAL") {
            await Promise.all(
              recipients
                .filter((recipient) => recipient.email)
                .map((recipient) =>
                  emailService
                    .sendEmail({
                      to: recipient.email!,
                      subject: `[CRITICAL] Stock Alert: ${setting.barang.nama}`,
                      html: `
                            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                <h2 style="color: #dc2626;">🚨 Stok Habis: ${setting.barang.nama}</h2>
                                <p>Barang <strong>${setting.barang.nama}</strong> di gudang <strong>${setting.gudang.nama}</strong> telah habis.</p>
                                <div style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; margin: 15px 0;">
                                    <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${currentStock.stok} ${setting.barang.satuan}</p>
                                    <p style="margin: 5px 0;"><strong>Min Stock:</strong> ${setting.minStok}</p>
                                    <p style="margin: 5px 0;"><strong>Recommended Order:</strong> ${recommendedOrder}</p>
                                </div>
                                <p>Mohon segera lakukan restock atau buat Purchase Request melalui dashboard.</p>
                                <a href="${process.env.NEXTAUTH_URL}/admin/inventory/restock" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Buka Dashboard Restock</a>
                            </div>
                          `,
                    })
                    .catch((error) =>
                      logger.error(
                        `Failed to send email to ${recipient.email}`,
                        error,
                      ),
                    ),
                ),
            );
          }
        }
      } catch (error) {
        logger.error("Failed to process restock settings", error as Error);
      }
    }

    return {
      processed: settings.length,
      newAlerts: newAlerts.length,
      notificationsSent,
    };
  }

  private buildAlertDecision(
    setting: {
      barang: { nama: string; satuan: string };
      gudang: { nama: string };
      minStok: number;
      maxStok: number;
    },
    currentStock: number,
  ) {
    if (currentStock === 0) {
      return {
        alertType: "STOCK_OUT" as const,
        urgency: "CRITICAL" as const,
        message: `STOK HABIS! ${setting.barang.nama} di ${setting.gudang.nama} kosong`,
      };
    }

    if (currentStock <= setting.minStok) {
      return {
        alertType: "LOW_STOCK" as const,
        urgency:
          currentStock <= setting.minStok * 0.5
            ? ("HIGH" as const)
            : ("MEDIUM" as const),
        message: `Stok rendah! ${setting.barang.nama} di ${setting.gudang.nama} tersisa ${currentStock} ${setting.barang.satuan} (min: ${setting.minStok})`,
      };
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
}

let inventoryRestockCheckServiceInstance: InventoryRestockCheckService | null =
  null;

export function getInventoryRestockCheckService() {
  if (!inventoryRestockCheckServiceInstance) {
    inventoryRestockCheckServiceInstance = new InventoryRestockCheckService();
  }

  return inventoryRestockCheckServiceInstance;
}
