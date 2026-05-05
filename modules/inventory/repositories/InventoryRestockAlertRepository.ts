import { PrismaClient, Prisma, AlertType } from "@prisma/client";
import type { RestockSettingRecord } from "./inventory-repository.contracts";

export class InventoryRestockAlertRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Ambil restock setting aktif beserta barang dan gudang. */
  async findActiveRestockSettings(): Promise<RestockSettingRecord[]> {
    return this.db.restockSettings.findMany({
      where: { isActive: true },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    }) as Promise<RestockSettingRecord[]>;
  }

  /** Ambil user penerima notifikasi restock. */
  async findRestockNotificationRecipients() {
    return this.db.user.findMany({
      where: {
        isActive: true,
        role: {
          permission: {
            some: { resource: "restock", action: "read" },
          },
        },
      },
      select: { id: true, email: true },
    });
  }

  /** Ambil stok barang per gudang. */
  async findBarangGudangStock(barangId: string, gudangId: string) {
    return this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
    });
  }

  /** Cari alert restock aktif dengan tipe yang sama. */
  async findOpenRestockAlert(input: {
    barangId: string;
    gudangId: string;
    alertType: AlertType;
  }) {
    return this.db.restockAlerts.findFirst({
      where: {
        barangId: input.barangId,
        gudangId: input.gudangId,
        alertType: input.alertType,
        isResolved: false,
      },
    });
  }

  /** Simpan alert restock baru. */
  async createRestockAlert(data: Prisma.RestockAlertsUncheckedCreateInput) {
    return this.db.restockAlerts.create({ data });
  }

  /** Simpan banyak notifikasi inventory sekaligus. */
  async createNotifications(data: Prisma.NotificationsCreateManyInput[]) {
    return this.db.notifications.createMany({ data });
  }
}
