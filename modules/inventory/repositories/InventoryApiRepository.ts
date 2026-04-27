import { randomUUID } from "crypto";

import { Prisma, PurchaseRequestStatus } from "@prisma/client";

import { STOCK_FIELD_MAP } from "@/lib/constants/inventory";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";

const DEFAULT_RESTOCK_LEAD_DAYS = 7;
const THIRTY_DAYS = 30;
const LOW_STOCK_RATIO = 0.5;
const DEFAULT_STOCKOUT_DAYS = 999;
const USAGE_TREND_THRESHOLD_RATIO = 0.1;
const MONTHLY_USAGE_WINDOW = 6;

export type RestockPredictionItem = {
  barangId: string;
  gudangId: string;
  barangKode: string;
  barangNama: string;
  satuan: string;
  gudangKode: string;
  gudangNama: string;
  currentStok: number;
  minStok: number;
  maxStok: number;
  avgDailyUsage: number;
  leadTimeDays: number;
  safetyStok: number;
  daysUntilStockout: number;
  reorderPoint: number;
  recommendedOrderQty: number;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastRestockDate?: string;
  usageTrend: "INCREASING" | "DECREASING" | "STABLE";
  monthlyUsage: number[];
  nextRestockDate: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

export class InventoryApiRepository {
  /** Ambil site user untuk pembatasan akses route inventory. */
  async findUserSiteId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { siteId: true },
    });

    return user?.siteId || undefined;
  }

  /** Ambil statistik inventory berbasis filter site. */
  async findInventoryStats(input: { siteId?: string; startOfDay: Date }) {
    const gudangFilter: Prisma.GudangWhereInput = { isActive: true };
    const masukFilter: Prisma.BarangMasukWhereInput = {
      createdAt: { gte: input.startOfDay },
    };
    const keluarFilter: Prisma.BarangKeluarWhereInput = {
      createdAt: { gte: input.startOfDay },
    };

    if (input.siteId) {
      const siteFilter = { sites: { some: { id: input.siteId } } };
      gudangFilter.sites = { some: { id: input.siteId } };
      masukFilter.gudang = siteFilter;
      keluarFilter.gudang = siteFilter;
    }

    const [totalBarang, barangMasukToday, barangKeluarToday, totalGudang] =
      await Promise.all([
        prisma.barang.count(),
        prisma.barangMasuk.count({ where: masukFilter }),
        prisma.barangKeluar.count({ where: keluarFilter }),
        prisma.gudang.count({ where: gudangFilter }),
      ]);

    return { totalBarang, barangMasukToday, barangKeluarToday, totalGudang };
  }

  /** Ambil analitik penggunaan barang per gudang. */
  async findUsageAnalytics(input: {
    barangId: string;
    gudangId: string;
    days: number;
  }) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - input.days);

    const [usageData, monthlyUsage, currentStock] = await Promise.all([
      prisma.barangKeluar.aggregate({
        where: {
          barangId: input.barangId,
          gudangId: input.gudangId,
          tanggal: { gte: startDate },
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      this.findMonthlyUsageWithLabels(input.barangId, input.gudangId),
      prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: input.barangId,
            gudangId: input.gudangId,
          },
        },
      }),
    ]);

    return { usageData, monthlyUsage, currentStock };
  }

  /** Ambil daftar alert restock beserta jumlah unread. */
  async findRestockAlerts(input: {
    barangId?: string;
    gudangId?: string;
    isRead?: boolean;
    isResolved?: boolean;
    urgency?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.RestockAlertsWhereInput = {};
    const offset = (input.page - 1) * input.limit;

    if (input.barangId) where.barangId = input.barangId;
    if (input.gudangId) where.gudangId = input.gudangId;
    if (input.isRead !== undefined) where.isRead = input.isRead;
    if (input.isResolved !== undefined) where.isResolved = input.isResolved;
    if (input.urgency) where.urgency = input.urgency as never;

    const [alerts, total, unreadCount] = await Promise.all([
      prisma.restockAlerts.findMany({
        where,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: input.limit,
      }),
      prisma.restockAlerts.count({ where }),
      prisma.restockAlerts.count({
        where: { ...where, isRead: false, isResolved: false },
      }),
    ]);

    return { alerts, total, unreadCount };
  }

  /** Jalankan auto check dan buat alert restock baru bila perlu. */
  async autoCheckRestockAlerts() {
    const settings = await prisma.restockSettings.findMany({
      where: { isActive: true },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });

    const newAlerts = [];

    for (const setting of settings) {
      const stock = await prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
          },
        },
      });

      if (!stock) continue;
      const decision = this.buildAlertDecision(setting, stock.stok);
      if (!decision) continue;

      const existing = await prisma.restockAlerts.findFirst({
        where: {
          barangId: setting.barangId,
          gudangId: setting.gudangId,
          alertType: decision.alertType,
          isResolved: false,
        },
      });

      if (existing) continue;
      const recommendedOrder = Math.max(0, setting.maxStok - stock.stok);
      const created = await prisma.restockAlerts.create({
        data: {
          id: randomUUID(),
          barangId: setting.barangId,
          gudangId: setting.gudangId,
          alertType: decision.alertType,
          currentStok: stock.stok,
          minStok: setting.minStok,
          recommendedOrder,
          urgency: decision.urgency,
          message: decision.message,
        },
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
      });

      newAlerts.push(created);
    }

    return newAlerts;
  }

  /** Ambil daftar pengaturan restock. */
  async findRestockSettings(input: {
    barangId?: string;
    gudangId?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.RestockSettingsWhereInput = {};
    const offset = (input.page - 1) * input.limit;

    if (input.barangId) where.barangId = input.barangId;
    if (input.gudangId) where.gudangId = input.gudangId;

    const [settings, total] = await Promise.all([
      prisma.restockSettings.findMany({
        where,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: input.limit,
      }),
      prisma.restockSettings.count({ where }),
    ]);

    return { settings, total };
  }

  /** Simpan pengaturan restock dan buat alert jika stok rendah. */
  async saveRestockSettings(input: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    safetyStok?: number;
    leadTimeDays?: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const [barang, gudang] = await Promise.all([
        tx.barang.findUnique({ where: { id: input.barangId } }),
        tx.gudang.findUnique({
          where: { id: input.gudangId, isActive: true },
        }),
      ]);

      if (!barang) throw new Error("Barang tidak ditemukan");
      if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - THIRTY_DAYS);

      const usageData = await tx.barangKeluar.aggregate({
        where: {
          barangId: input.barangId,
          gudangId: input.gudangId,
          tanggal: { gte: thirtyDaysAgo },
        },
        _sum: { jumlah: true },
      });

      const avgDailyUsage = (usageData._sum.jumlah || 0) / THIRTY_DAYS;
      const settings = await tx.restockSettings.upsert({
        where: {
          barangId_gudangId: {
            barangId: input.barangId,
            gudangId: input.gudangId,
          },
        },
        update: {
          minStok: input.minStok,
          maxStok: input.maxStok,
          safetyStok: input.safetyStok || 0,
          leadTimeDays: input.leadTimeDays || DEFAULT_RESTOCK_LEAD_DAYS,
          avgDailyUsage,
          lastUsageCalculation: new Date(),
          isActive: true,
        },
        create: {
          id: randomUUID(),
          barangId: input.barangId,
          gudangId: input.gudangId,
          minStok: input.minStok,
          maxStok: input.maxStok,
          safetyStok: input.safetyStok || 0,
          leadTimeDays: input.leadTimeDays || DEFAULT_RESTOCK_LEAD_DAYS,
          avgDailyUsage,
          updatedAt: new Date(),
        },
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
      });

      await this.createThresholdAlertIfNeeded(tx, {
        barangId: input.barangId,
        gudangId: input.gudangId,
        minStok: input.minStok,
        maxStok: input.maxStok,
        barangNama: barang.nama,
        gudangNama: gudang.nama,
        satuan: barang.satuan,
      });

      return settings;
    });
  }

  /** Bangun prediksi restock dari setting aktif. */
  async findRestockPredictions(input: { gudangId?: string; days: number }) {
    const where: Prisma.RestockSettingsWhereInput = { isActive: true };
    if (input.gudangId) where.gudangId = input.gudangId;

    const settings = await prisma.restockSettings.findMany({
      where,
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });

    const predictions: RestockPredictionItem[] = [];

    for (const setting of settings) {
      const prediction = await this.buildRestockPrediction(setting, input.days);
      predictions.push(prediction);
    }

    predictions.sort((firstItem, secondItem) => {
      const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const urgencyDiff =
        urgencyOrder[secondItem.urgency] - urgencyOrder[firstItem.urgency];

      if (urgencyDiff !== 0) return urgencyDiff;
      return firstItem.daysUntilStockout - secondItem.daysUntilStockout;
    });

    return predictions;
  }

  /** Ambil daftar purchase request restock. */
  async findPurchaseRequests(input: {
    tenantId: string;
    status?: string | null;
  }) {
    const requests = await prisma.purchaseRequest.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.status
          ? { status: input.status as PurchaseRequestStatus }
          : {}),
      },
      include: {
        items: { include: { barang: true } },
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true, id: true } },
        purchaseOrder: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((request) => ({
      ...request,
      items: request.items.map((item) => ({
        ...item,
        receivedQuantity:
          request.purchaseOrder?.items.find(
            (purchaseOrderItem) => purchaseOrderItem.barangId === item.barangId,
          )?.receivedQuantity || 0,
      })),
    }));
  }

  /** Ambil purchase request milik tenant tertentu. */
  async findPurchaseRequestById(input: { id: string; tenantId: string }) {
    return prisma.purchaseRequest.findUnique({
      where: { id: input.id, tenantId: input.tenantId },
    });
  }

  /** Perbarui item purchase request draft/submitted. */
  async updatePurchaseRequest(input: {
    id: string;
    tenantId: string;
    gudangId: string;
    keterangan?: string;
    items: Array<{
      barangId: string;
      quantity: number;
      keterangan?: string | null;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.purchaseRequestItem.deleteMany({
        where: { purchaseRequestId: input.id },
      });

      return tx.purchaseRequest.update({
        where: { id: input.id },
        data: {
          gudangId: input.gudangId,
          keterangan: input.keterangan,
          items: {
            create: input.items.map((item) => ({
              id: randomUUID(),
              barangId: item.barangId,
              jumlah: item.quantity,
              keterangan: item.keterangan || null,
              hargaPerUnit: 0,
              totalHarga: 0,
              tenantId: input.tenantId,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  /** Hapus purchase request. */
  async deletePurchaseRequest(id: string) {
    await prisma.purchaseRequest.delete({ where: { id } });
  }

  /** Setujui purchase request sederhana untuk route approve. */
  async approvePurchaseRequest(input: { id: string; approverId: string }) {
    return prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: "APPROVED",
        approvedBy: input.approverId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /** Ambil ringkasan purchase request untuk proses receive/start shopping. */
  async findPurchaseRequestProcessInfo(id: string) {
    return prisma.purchaseRequest.findUnique({
      where: { id },
      select: { purchaseOrderId: true, status: true },
    });
  }

  /** Ambil summary opname berbasis stok dan opname terakhir. */
  async findOpnameSummary(gudangId?: string) {
    const whereClause = gudangId ? { gudangId } : {};
    const [barangGudangs, latestOpnames] = await Promise.all([
      prisma.barangGudang.findMany({
        where: whereClause,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
      }),
      prisma.stockOpname.groupBy({
        by: ["barangId", "gudangId"],
        where: whereClause,
        _max: { tanggal: true },
      }),
    ]);

    return barangGudangs.map((barangGudang) => ({
      id: barangGudang.id,
      barang: barangGudang.barang,
      gudang: barangGudang.gudang,
      stokSistem: barangGudang.stok,
      lastOpname: latestOpnames.find(
        (item) =>
          item.barangId === barangGudang.barangId &&
          item.gudangId === barangGudang.gudangId,
      )?._max.tanggal,
    }));
  }

  /** Ambil laporan opname per gudang. */
  async findOpnameReport(gudangId?: string) {
    const gudangs = await prisma.gudang.findMany({
      where: { isActive: true, ...(gudangId ? { id: gudangId } : {}) },
      include: {
        barangGudang: {
          include: {
            barang: {
              select: { id: true, kode: true, nama: true, satuan: true },
            },
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    const gudangList = [];

    for (const gudang of gudangs) {
      const items = [];

      for (const stockItem of gudang.barangGudang) {
        const [masukData, keluarData] = await Promise.all([
          prisma.barangMasuk.findMany({
            where: { barangId: stockItem.barangId, gudangId: gudang.id },
          }),
          prisma.barangKeluar.findMany({
            where: { barangId: stockItem.barangId, gudangId: gudang.id },
          }),
        ]);

        const stockByCondition = this.calculateStockByCondition(
          masukData,
          keluarData,
        );
        const totalHilang = keluarData
          .filter((item) => item.isHilang)
          .reduce((sum, item) => sum + item.jumlah, 0);

        items.push({
          barangId: stockItem.barangId,
          barangKode: stockItem.barang.kode,
          barangNama: stockItem.barang.nama,
          barangSatuan: stockItem.barang.satuan,
          stokTotal: stockItem.stok,
          stokBaru: stockByCondition.stokBaru,
          stokBekas: stockByCondition.stokBekas,
          stokRusak: stockByCondition.stokRusak,
          totalHilang,
        });
      }

      gudangList.push({
        gudangId: gudang.id,
        gudangKode: gudang.kode,
        gudangNama: gudang.nama,
        gudangLokasi: gudang.lokasi,
        totalBarang: items.length,
        totalStok: items.reduce((sum, item) => sum + item.stokTotal, 0),
        totalHilang: items.reduce((sum, item) => sum + item.totalHilang, 0),
        items,
      });
    }

    return gudangList;
  }

  /** Hitung data awal opname untuk satu gudang. */
  async calculateOpname(gudangId: string) {
    const barangGudangs = await prisma.barangGudang.findMany({
      where: { gudangId },
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
            createdAt: true,
          },
        },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: { barang: { kode: "asc" } },
    });

    if (barangGudangs.length === 0) return [];
    const barangIds = barangGudangs.map((item) => item.barang.id);
    const [allMasuk, allKeluar] = await Promise.all([
      prisma.barangMasuk.findMany({
        where: { gudangId, barangId: { in: barangIds } },
      }),
      prisma.barangKeluar.findMany({
        where: { gudangId, barangId: { in: barangIds } },
      }),
    ]);

    return barangGudangs.map((barangGudang) => {
      const masukItems = allMasuk.filter(
        (item) => item.barangId === barangGudang.barang.id,
      );
      const keluarItems = allKeluar.filter(
        (item) => item.barangId === barangGudang.barang.id,
      );
      const stockByCondition = this.calculateStockByCondition(
        masukItems,
        keluarItems,
      );
      const adjusted = this.adjustStockCalculation(
        barangGudang.stok,
        stockByCondition,
      );

      return {
        barangId: barangGudang.barang.id,
        barangKode: barangGudang.barang.kode,
        barangNama: barangGudang.barang.nama,
        barangSatuan: barangGudang.barang.satuan,
        gudangId: barangGudang.gudang.id,
        gudangNama: barangGudang.gudang.nama,
        stokSistem: barangGudang.stok,
        stokFisik: barangGudang.stok,
        kondisiBaik: adjusted.kondisiBaik,
        kondisiRusak: adjusted.kondisiRusak,
        kondisiExpire: adjusted.kondisiExpire,
        lokasiPenyimpanan: barangGudang.gudang.nama,
        nomorRak: "",
        nomorBox: "",
        pic: "Gudang",
        suhuPenyimpanan: null as number | null,
        kelembaban: null as number | null,
        tanggalExpire: null as Date | null,
        nomorBatch: "",
        catatanDetail: `Stok sistem: ${barangGudang.stok} (Baru: ${stockByCondition.stokBaru}, Bekas: ${stockByCondition.stokBekas}, Rusak: ${stockByCondition.stokRusak}). Input stok fisik dan breakdown kondisi aktual.`,
      };
    });
  }

  /** Ambil stok barang dan relasinya. */
  async findStockInfo(barangId: string, gudangId: string) {
    return prisma.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
  }

  /** Ambil breakdown stok per kondisi. */
  async findStockBreakdown(barangId: string, gudangId: string) {
    const [stockSnapshot, barangInfo, gudangInfo] = await Promise.all([
      prisma.barangGudang.findUnique({
        where: { barangId_gudangId: { barangId, gudangId } },
        select: {
          stok: true,
          stokBaru: true,
          stokBekas: true,
          stokRusak: true,
        },
      }),
      prisma.barang.findUnique({
        where: { id: barangId },
        select: { id: true, kode: true, nama: true, satuan: true },
      }),
      prisma.gudang.findUnique({
        where: { id: gudangId },
        select: { id: true, kode: true, nama: true },
      }),
    ]);

    return { stockSnapshot, barangInfo, gudangInfo };
  }

  /** Ambil keluar record beserta site gudang untuk validasi akses. */
  async findKeluarRecordWithSite(id: string) {
    return prisma.barangKeluar.findUnique({
      where: { id },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            sites: { select: { id: true } },
          },
        },
      },
    });
  }

  /** Perbarui keluar record dan sinkronkan stok. */
  async updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const currentRecord = await tx.barangKeluar.findUnique({
        where: { id: input.id },
        include: { barang: true, gudang: true },
      });

      if (!currentRecord)
        throw new Error("Record barang keluar tidak ditemukan");
      const stockDifference = currentRecord.jumlah - input.jumlah;
      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
          },
        },
      });

      if (!currentStock) {
        throw new Error("Stok tidak ditemukan untuk barang dan gudang ini");
      }

      const stockField =
        STOCK_FIELD_MAP[
          currentRecord.kondisi as keyof typeof STOCK_FIELD_MAP
        ] || "stokBaru";
      const newStock = currentStock.stok + stockDifference;
      const newConditionStock =
        Number((currentStock as Record<string, unknown>)[stockField] || 0) +
        stockDifference;

      if (newStock < 0 || newConditionStock < 0) {
        throw new Error("Stok tidak mencukupi untuk perubahan ini");
      }

      await tx.barangKeluar.update({
        where: { id: input.id },
        data: { jumlah: input.jumlah, keterangan: input.keterangan },
      });
      await tx.barangGudang.update({
        where: {
          barangId_gudangId: {
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
          },
        },
        data: { stok: newStock, [stockField]: newConditionStock },
      });

      return {
        barangNama: currentRecord.barang.nama,
        jumlahLama: currentRecord.jumlah,
      };
    });
  }

  /** Hapus keluar record dan kembalikan stok. */
  async deleteKeluarRecord(id: string) {
    return prisma.$transaction(async (tx) => {
      const keluarRecord = await tx.barangKeluar.findUnique({
        where: { id },
        include: { barang: true, gudang: true },
      });

      if (!keluarRecord)
        throw new Error("Record barang keluar tidak ditemukan");
      const stockField =
        STOCK_FIELD_MAP[keluarRecord.kondisi as keyof typeof STOCK_FIELD_MAP] ||
        "stokBaru";
      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: keluarRecord.barangId,
            gudangId: keluarRecord.gudangId,
          },
        },
      });

      if (currentStock) {
        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: keluarRecord.barangId,
              gudangId: keluarRecord.gudangId,
            },
          },
          data: {
            stok: currentStock.stok + keluarRecord.jumlah,
            [stockField]:
              Number(
                (currentStock as Record<string, unknown>)[stockField] || 0,
              ) + keluarRecord.jumlah,
          },
        });
      } else {
        await tx.barangGudang.create({
          data: {
            id: randomUUID(),
            barangId: keluarRecord.barangId,
            gudangId: keluarRecord.gudangId,
            stok: keluarRecord.jumlah,
            [stockField]: keluarRecord.jumlah,
            updatedAt: new Date(),
          },
        });
      }

      await tx.barangKeluar.delete({ where: { id } });
      return {
        barangNama: keluarRecord.barang.nama,
        jumlah: keluarRecord.jumlah,
      };
    });
  }

  /** Verifikasi transaksi upload foto inventory. */
  async verifyInventoryTransaction(input: {
    transactionId: string;
    transactionType: string;
  }) {
    if (input.transactionType === "inventory-masuk") {
      return prisma.barangMasuk.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true, gudangId: true },
      });
    }

    if (input.transactionType === "inventory-keluar") {
      return prisma.barangKeluar.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true, gudangId: true },
      });
    }

    if (input.transactionType === "inventory-transfer") {
      return prisma.transferAntarGudang.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true },
      });
    }

    return { id: input.transactionId };
  }

  private async createThresholdAlertIfNeeded(
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
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
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
    const recommendedOrder = input.maxStok - currentStock.stok;
    const urgency =
      currentStock.stok === 0
        ? "CRITICAL"
        : currentStock.stok <= input.minStok * LOW_STOCK_RATIO
          ? "HIGH"
          : "MEDIUM";

    await tx.restockAlerts.create({
      data: {
        id: randomUUID(),
        barangId: input.barangId,
        gudangId: input.gudangId,
        alertType: "RESTOCK_NEEDED",
        currentStok: currentStock.stok,
        minStok: input.minStok,
        recommendedOrder,
        urgency,
        message: `Stok ${input.barangNama} di ${input.gudangNama} rendah. Sisa: ${currentStock.stok} ${input.satuan}, Min: ${input.minStok} ${input.satuan}`,
      },
    });
  }

  private async buildRestockPrediction(
    setting: {
      id: string;
      barangId: string;
      gudangId: string;
      minStok: number;
      maxStok: number;
      avgDailyUsage: number;
      leadTimeDays: number;
      safetyStok: number;
      barang: { kode: string; nama: string; satuan: string };
      gudang: { kode: string; nama: string };
    },
    days: number,
  ): Promise<RestockPredictionItem> {
    const analysisStartDate = new Date();
    analysisStartDate.setDate(analysisStartDate.getDate() - days);

    const [currentStock, monthlyUsage, lastRestock, recentUsage] =
      await Promise.all([
        prisma.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId: setting.barangId,
              gudangId: setting.gudangId,
            },
          },
        }),
        this.findMonthlyUsageNumbers(
          setting.barangId,
          setting.gudangId,
          MONTHLY_USAGE_WINDOW,
        ),
        prisma.barangMasuk.findFirst({
          where: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            transferId: null,
          },
          orderBy: { tanggal: "desc" },
        }),
        prisma.barangKeluar.aggregate({
          where: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            tanggal: { gte: analysisStartDate },
          },
          _sum: { jumlah: true },
        }),
      ]);

    const avgDailyUsage = (recentUsage._sum.jumlah || 0) / days;

    if (avgDailyUsage !== setting.avgDailyUsage) {
      await prisma.restockSettings.update({
        where: { id: setting.id },
        data: { avgDailyUsage, lastUsageCalculation: new Date() },
      });
    }

    const currentStok = currentStock?.stok || 0;
    const daysUntilStockout =
      avgDailyUsage > 0
        ? Math.floor(currentStok / avgDailyUsage)
        : DEFAULT_STOCKOUT_DAYS;
    const usageDuringLeadTime = Math.ceil(avgDailyUsage * setting.leadTimeDays);
    const reorderPoint =
      setting.minStok + setting.safetyStok + usageDuringLeadTime;
    const recommendedOrderQty = Math.max(0, setting.maxStok - currentStok);
    const urgency = this.calculatePredictionUrgency(
      currentStok,
      setting.minStok,
      setting.leadTimeDays,
      daysUntilStockout,
    );
    const riskLevel = this.calculateRiskLevel(
      setting.leadTimeDays,
      daysUntilStockout,
    );
    const usageTrend = this.calculateUsageTrend(monthlyUsage);
    const nextRestockDate = this.calculateNextRestockDate(
      avgDailyUsage,
      currentStok,
      daysUntilStockout,
      setting.leadTimeDays,
    );

    return {
      barangId: setting.barangId,
      gudangId: setting.gudangId,
      barangKode: setting.barang.kode,
      barangNama: setting.barang.nama,
      satuan: setting.barang.satuan,
      gudangKode: setting.gudang.kode,
      gudangNama: setting.gudang.nama,
      currentStok,
      minStok: setting.minStok,
      maxStok: setting.maxStok,
      avgDailyUsage,
      leadTimeDays: setting.leadTimeDays,
      safetyStok: setting.safetyStok,
      daysUntilStockout,
      reorderPoint,
      recommendedOrderQty,
      urgency,
      ...(lastRestock?.tanggal
        ? { lastRestockDate: lastRestock.tanggal.toISOString() }
        : {}),
      usageTrend,
      monthlyUsage,
      nextRestockDate,
      riskLevel,
    };
  }

  private calculatePredictionUrgency(
    currentStok: number,
    minStok: number,
    leadTimeDays: number,
    daysUntilStockout: number,
  ) {
    if (currentStok === 0) return "CRITICAL" as const;
    if (currentStok <= minStok) return "HIGH" as const;
    if (daysUntilStockout <= leadTimeDays) return "HIGH" as const;
    if (daysUntilStockout <= leadTimeDays * 2) return "MEDIUM" as const;
    return "LOW" as const;
  }

  private calculateRiskLevel(leadTimeDays: number, daysUntilStockout: number) {
    if (daysUntilStockout <= leadTimeDays) return "HIGH" as const;
    if (daysUntilStockout <= leadTimeDays * 2) return "MEDIUM" as const;
    return "LOW" as const;
  }

  private calculateNextRestockDate(
    avgDailyUsage: number,
    currentStok: number,
    daysUntilStockout: number,
    leadTimeDays: number,
  ) {
    const nextRestockDate = new Date();

    if (avgDailyUsage > 0 && currentStok > 0) {
      nextRestockDate.setDate(
        nextRestockDate.getDate() +
          Math.max(0, daysUntilStockout - leadTimeDays),
      );
      return nextRestockDate.toISOString();
    }

    nextRestockDate.setDate(nextRestockDate.getDate() + leadTimeDays);
    return nextRestockDate.toISOString();
  }

  private calculateUsageTrend(monthlyUsage: number[]) {
    if (monthlyUsage.length < 3) return "STABLE" as const;
    const count = monthlyUsage.length;
    const points = Array.from({ length: count }, (_, index) => index);
    const sumX = points.reduce((sum, value) => sum + value, 0);
    const sumY = monthlyUsage.reduce((sum, value) => sum + value, 0);
    const sumXY = points.reduce(
      (sum, point, index) => sum + point * (monthlyUsage[index] || 0),
      0,
    );
    const sumX2 = points.reduce((sum, point) => sum + point * point, 0);
    const slope = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);
    const threshold = (sumY / count) * USAGE_TREND_THRESHOLD_RATIO;

    if (slope > threshold) return "INCREASING" as const;
    if (slope < -threshold) return "DECREASING" as const;
    return "STABLE" as const;
  }

  private async findMonthlyUsageWithLabels(barangId: string, gudangId: string) {
    const monthlyUsage = [];

    for (let offset = MONTHLY_USAGE_WINDOW - 1; offset >= 0; offset -= 1) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - offset, 1);
      startDate.setTime(toStartOfDay(startDate).getTime());
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setTime(toEndOfDay(endDate).getTime());
      const usage = await prisma.barangKeluar.aggregate({
        where: {
          barangId,
          gudangId,
          tanggal: { gte: startDate, lte: endDate },
        },
        _sum: { jumlah: true },
      });

      monthlyUsage.push({
        month: startDate.toLocaleString("id-ID", {
          month: "short",
          year: "numeric",
        }),
        usage: usage._sum.jumlah || 0,
      });
    }

    return monthlyUsage;
  }

  private async findMonthlyUsageNumbers(
    barangId: string,
    gudangId: string,
    months: number,
  ) {
    const values: number[] = [];

    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - offset, 1);
      startDate.setTime(toStartOfDay(startDate).getTime());
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setTime(toEndOfDay(endDate).getTime());
      const usage = await prisma.barangKeluar.aggregate({
        where: {
          barangId,
          gudangId,
          tanggal: { gte: startDate, lte: endDate },
        },
        _sum: { jumlah: true },
      });

      values.push(usage._sum.jumlah || 0);
    }

    return values;
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
          currentStock <= setting.minStok * LOW_STOCK_RATIO
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

  private calculateStockByCondition(
    masukItems: Array<{ kondisi: string; jumlah: number }>,
    keluarItems: Array<{ kondisi: string; jumlah: number }>,
  ) {
    let stokBaru = 0;
    let stokBekas = 0;
    let stokRusak = 0;

    masukItems.forEach((item) => {
      if (item.kondisi === "BEKAS") stokBekas += item.jumlah;
      else if (item.kondisi === "RUSAK") stokRusak += item.jumlah;
      else stokBaru += item.jumlah;
    });

    keluarItems.forEach((item) => {
      if (item.kondisi === "BEKAS")
        stokBekas = Math.max(0, stokBekas - item.jumlah);
      else if (item.kondisi === "RUSAK")
        stokRusak = Math.max(0, stokRusak - item.jumlah);
      else stokBaru = Math.max(0, stokBaru - item.jumlah);
    });

    return { stokBaru, stokBekas, stokRusak };
  }

  private adjustStockCalculation(
    stokSistem: number,
    stockByCondition: {
      stokBaru: number;
      stokBekas: number;
      stokRusak: number;
    },
  ) {
    const calculatedTotal =
      stockByCondition.stokBaru +
      stockByCondition.stokBekas +
      stockByCondition.stokRusak;
    const difference = stokSistem - calculatedTotal;
    const kondisiBaik =
      calculatedTotal !== stokSistem && calculatedTotal > 0
        ? Math.max(0, stockByCondition.stokBaru + difference)
        : stockByCondition.stokBaru;

    return {
      kondisiBaik,
      kondisiRusak: stockByCondition.stokRusak,
      kondisiExpire: stockByCondition.stokBekas,
    };
  }
}
