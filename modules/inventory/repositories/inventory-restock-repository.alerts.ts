import { Prisma, AlertType, UrgencyLevel } from "@prisma/client";
import { randomUUID } from "node:crypto";

type PrismaClientLike = Prisma.TransactionClient;

/** Buat alert otomatis dari setting restock aktif bila stok melanggar ambang. */
export async function createRestockAlertFromSetting(
  db: PrismaClientLike,
  setting: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
  },
) {
  const stock = await db.barangGudang.findUnique({
    where: {
      barangId_gudangId: {
        barangId: setting.barangId,
        gudangId: setting.gudangId,
      },
    },
  });
  if (!stock) return null;

  const decision = buildAlertDecision(setting, stock.stok);
  if (!decision) return null;

  const existing = await db.restockAlerts.findFirst({
    where: {
      barangId: setting.barangId,
      gudangId: setting.gudangId,
      alertType: decision.alertType,
      isResolved: false,
    },
  });
  if (existing) return null;

  return db.restockAlerts.create({
    data: {
      id: randomUUID(),
      barangId: setting.barangId,
      gudangId: setting.gudangId,
      alertType: decision.alertType,
      currentStok: stock.stok,
      minStok: setting.minStok,
      recommendedOrder: Math.max(0, setting.maxStok - stock.stok),
      urgency: decision.urgency,
      message: decision.message,
    },
    include: {
      barang: { select: { id: true, kode: true, nama: true, satuan: true } },
      gudang: { select: { id: true, kode: true, nama: true } },
    },
  });
}

function buildAlertDecision(
  setting: {
    minStok: number;
    maxStok: number;
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
  },
  currentStok: number,
) {
  if (currentStok === 0) {
    return {
      alertType: AlertType.STOCK_OUT,
      urgency: UrgencyLevel.CRITICAL,
      message: `Stok ${setting.barang.nama} di ${setting.gudang.nama} habis`,
    };
  }
  if (currentStok < setting.minStok) {
    return {
      alertType: AlertType.LOW_STOCK,
      urgency:
        currentStok <= setting.minStok * 0.5
          ? UrgencyLevel.HIGH
          : UrgencyLevel.MEDIUM,
      message: `Stok ${setting.barang.nama} di ${setting.gudang.nama} rendah. Sisa: ${currentStok} ${setting.barang.satuan}, Min: ${setting.minStok} ${setting.barang.satuan}`,
    };
  }
  if (currentStok > setting.maxStok) {
    return {
      alertType: AlertType.OVERSTOCK,
      urgency: UrgencyLevel.LOW,
      message: `Stok ${setting.barang.nama} di ${setting.gudang.nama} berlebih. Sisa: ${currentStok} ${setting.barang.satuan}, Max: ${setting.maxStok} ${setting.barang.satuan}`,
    };
  }
  return null;
}

/** Buat alert threshold bila stok saat ini sudah di bawah minimum. */
export async function createThresholdAlertIfNeeded(
  tx: Prisma.TransactionClient,
  input: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    barangNama: string;
    gudangNama: string;
    satuan: string;
  },
) {
  const currentStock = await tx.barangGudang.findUnique({
    where: {
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
  });
  if (!currentStock || currentStock.stok > input.minStok) return;

  const existingAlert = await tx.restockAlerts.findFirst({
    where: {
      barangId: input.barangId,
      gudangId: input.gudangId,
      isResolved: false,
      alertType: "RESTOCK_NEEDED",
    },
  });
  if (existingAlert) return;

  await tx.restockAlerts.create({
    data: {
      id: randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      alertType: AlertType.RESTOCK_NEEDED,
      currentStok: currentStock.stok,
      minStok: input.minStok,
      recommendedOrder: input.maxStok - currentStock.stok,
      urgency: getThresholdUrgency(currentStock.stok, input.minStok),
      message: `Stok ${input.barangNama} di ${input.gudangNama} rendah. Sisa: ${currentStock.stok} ${input.satuan}, Min: ${input.minStok} ${input.satuan}`,
    },
  });
}

function getThresholdUrgency(
  currentStok: number,
  minStok: number,
): UrgencyLevel {
  if (currentStok === 0) return UrgencyLevel.CRITICAL;
  if (currentStok <= minStok * 0.5) return UrgencyLevel.HIGH;
  return UrgencyLevel.MEDIUM;
}
