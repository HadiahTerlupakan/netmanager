import { prisma } from "@/lib/prisma";
import type { Prisma, WorkOrderStatus } from "@prisma/client";

type MaterialUpdateRecord = Awaited<
  ReturnType<typeof prisma.workOrderUpdates.findUnique>
> & {
  user?: { id: string; name: string | null; email: string | null } | null;
  workOrders?: {
    workOrderNumber: string;
    usedMaterials: unknown;
    returnedMaterials: unknown;
  } | null;
};

const DEFAULT_LIMIT = 5;
const LAST_30_DAYS = 30;
const HOURS_TO_MS = 60 * 60 * 1000;
const DAYS_TO_MS = 24 * HOURS_TO_MS;

export interface AdminWorkOrderUserProfile {
  id: string;
  role: string | null;
  departmentId: string | null;
  siteId: string | null;
}

export interface ReminderWorkOrderData {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  status: WorkOrderStatus;
  departmentId: string | null;
  siteId: string | null;
  assignedToId: string | null;
}

interface MaterialMessageParseResult {
  namaBarang: string;
  kondisi: string;
  jumlah: number;
  satuan: string;
}

interface MaterialSourceItem {
  id?: string;
  nama?: string;
  barangId?: string;
  gudangId?: string | null;
  barang?: { id?: string; nama?: string };
  gudang?: { id?: string };
}

/** Repository pendukung route admin work order. */
export class AdminWorkOrderRouteRepository {
  /** Ambil profil user minimum untuk RBAC route admin. */
  async findUserProfile(
    userId: string,
  ): Promise<AdminWorkOrderUserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        departmentId: true,
        siteId: true,
        role: { select: { name: true } },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role?.name || null,
      departmentId: user.departmentId,
      siteId: user.siteId,
    };
  }

  /** Ambil gudang default berdasarkan site user. */
  async findFirstGudangBySite(siteId: string): Promise<string | null> {
    const gudang = await prisma.gudang.findFirst({
      where: { sites: { some: { id: siteId } } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return gudang?.id ?? null;
  }

  /** Ambil data minimum work order untuk fitur reminder. */
  async findReminderWorkOrderById(
    id: string,
  ): Promise<ReminderWorkOrderData | null> {
    return prisma.workOrders.findUnique({
      where: { id },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
      },
    }) as Promise<ReminderWorkOrderData | null>;
  }

  /** Reset relasi canvasing saat work order dihapus permanen. */
  async resetCanvasingByWorkOrderId(workOrderId: string): Promise<void> {
    await prisma.canvasing.updateMany({
      where: { workOrderId },
      data: {
        status: "PENDING",
        workOrderId: null,
        approvedBy: null,
        approvedAt: null,
      },
    });
  }

  /** Ambil detail work order untuk kebutuhan notifikasi update. */
  async findWorkOrderNotificationPayload(id: string) {
    return prisma.workOrders.findUnique({
      where: { id },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        assignedTo: {
          select: { id: true, isActive: true },
        },
      },
    });
  }

  /** Cek apakah user sedang cuti hari ini. */
  async isUserOnApprovedLeave(
    userId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: now },
        endDate: { gte: startOfToday },
      },
      select: { id: true },
    });

    return Boolean(leaveRequest);
  }

  /** Ambil detail material dari activity update work order. */
  async findMaterialDetail(workOrderId: string, updateId: string) {
    const update = (await prisma.workOrderUpdates.findUnique({
      where: { id: updateId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workOrders: {
          select: {
            workOrderNumber: true,
            usedMaterials: true,
            returnedMaterials: true,
          },
        },
      },
    })) as MaterialUpdateRecord | null;

    if (!update) {
      return { code: "NOT_FOUND" as const };
    }

    if (update.workOrderId !== workOrderId) {
      return { code: "INVALID_WORK_ORDER" as const };
    }

    const message = update.message || "";
    const isPickup = update.updateType === "MATERIAL_PICKUP";
    const sourceMaterials = this.getSourceMaterials(
      update.workOrders,
      isPickup,
    );
    const parsedMessage = this.parseMaterialMessage(message);
    const materialDetail = await this.buildMaterialDetail({
      update,
      message,
      isPickup,
      sourceMaterials,
      parsedMessage,
      updateId,
    });

    return { code: "OK" as const, data: materialDetail };
  }

  /** Ambil work order stale untuk cron reminder. */
  async findStaleReminderWorkOrders(now: Date) {
    return prisma.workOrders.findMany({
      where: {
        status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        createdAt: { lte: new Date(now.getTime() - LAST_30_DAYS * DAYS_TO_MS) },
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  /** Hitung total work order customer vs internal. */
  async countWorkOrderTypes(filters: {
    departmentId?: string;
    siteId?: string;
  }) {
    const where = this.buildWorkOrderWhere(filters);
    const [customer, internal] = await Promise.all([
      prisma.workOrders.count({ where: { ...where, isInternal: false } }),
      prisma.workOrders.count({ where: { ...where, isInternal: true } }),
    ]);

    return { customer, internal };
  }

  /** Ambil statistik response admin. */
  async getAdminResponseStats(
    dateFrom: Date,
    dateTo: Date,
    departmentId?: string,
  ) {
    const workOrderRepo = await import("./WorkOrderRepository");
    return new workOrderRepo.WorkOrderRepository(prisma).getAdminResponseStats(
      dateFrom,
      dateTo,
      departmentId,
    );
  }

  /** Ambil top performer dan top assist admin dashboard. */
  async getTopPerformanceSummary(options: {
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
    departmentId?: string;
  }) {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const workOrderRepo = await import("./WorkOrderRepository");
    const repository = new workOrderRepo.WorkOrderRepository(prisma);
    const [performers, topAssists] = await Promise.all([
      repository.getTopPerformers(
        limit,
        options.dateFrom,
        options.dateTo,
        options.departmentId,
      ),
      repository.getTopAssists(
        limit,
        options.dateFrom,
        options.dateTo,
        options.departmentId,
      ),
    ]);

    return { performers, topAssists };
  }

  private buildWorkOrderWhere(filters: {
    departmentId?: string;
    siteId?: string;
  }) {
    const where: Prisma.WorkOrdersWhereInput = {};

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.siteId) {
      where.siteId = filters.siteId;
    }

    return where;
  }

  private getSourceMaterials(
    workOrder: { usedMaterials: unknown; returnedMaterials: unknown } | null,
    isPickup: boolean,
  ): MaterialSourceItem[] {
    if (!workOrder) {
      return [];
    }

    const materials = isPickup
      ? workOrder.usedMaterials
      : workOrder.returnedMaterials;
    return (materials as MaterialSourceItem[]) || [];
  }

  private parseMaterialMessage(
    message: string,
  ): MaterialMessageParseResult | null {
    const materialMatch = message.match(
      /(?:Mengambil|Mengembalikan) barang: (.+)/,
    );
    const materialInfo = materialMatch?.[1] ?? message;
    const detailMatch = materialInfo.match(/^(.+?) - (\w+) \((\d+) (.+?)\)/);

    if (!detailMatch) {
      return null;
    }

    return {
      namaBarang: detailMatch[1] || "Barang",
      kondisi: detailMatch[2] || "BARU",
      jumlah: Number.parseInt(detailMatch[3] || "1", 10) || 1,
      satuan: detailMatch[4] || "pcs",
    };
  }

  private async buildMaterialDetail(params: {
    update: NonNullable<MaterialUpdateRecord>;
    message: string;
    isPickup: boolean;
    sourceMaterials: MaterialSourceItem[];
    parsedMessage: MaterialMessageParseResult | null;
    updateId: string;
  }) {
    if (!params.parsedMessage) {
      return this.buildFallbackMaterialDetail(params);
    }

    const matchingMaterial = this.findMatchingMaterial(
      params.sourceMaterials,
      params.parsedMessage.namaBarang,
    );

    if (!matchingMaterial) {
      return this.buildMinimalMaterialDetail(params);
    }

    const relationData = await this.findMaterialRelations(matchingMaterial);
    const pickupDetail = await this.findPickupDetail(
      matchingMaterial.id,
      params.isPickup,
    );

    if (pickupDetail) {
      return {
        id: pickupDetail.id,
        type: "keluar",
        tanggal: pickupDetail.tanggal.toISOString(),
        createdAt: pickupDetail.createdAt.toISOString(),
        barang: pickupDetail.barang,
        gudang: pickupDetail.gudang,
        jumlah: pickupDetail.jumlah,
        kondisi: pickupDetail.kondisi,
        keterangan: pickupDetail.keterangan,
        user: pickupDetail.user || params.update.user,
        fotoBukti: pickupDetail.fotoBukti || [],
      };
    }

    return {
      id: matchingMaterial.id || params.updateId,
      type: params.isPickup ? "keluar" : "masuk",
      tanggal: params.update.createdAt.toISOString(),
      createdAt: params.update.createdAt.toISOString(),
      barang: relationData.barang || {
        kode: "-",
        nama: params.parsedMessage.namaBarang.trim(),
        satuan: params.parsedMessage.satuan,
      },
      gudang: relationData.gudang || { kode: "-", nama: "Gudang" },
      jumlah: params.parsedMessage.jumlah,
      kondisi: params.parsedMessage.kondisi,
      keterangan: `${params.isPickup ? "Pengambilan" : "Pengembalian"} untuk Work Order ${params.update.workOrders?.workOrderNumber}`,
      user: params.update.user,
      fotoBukti: [] as unknown[],
    };
  }

  private buildFallbackMaterialDetail(params: {
    update: NonNullable<MaterialUpdateRecord>;
    message: string;
    isPickup: boolean;
    updateId: string;
  }) {
    return {
      id: params.updateId,
      type: params.isPickup ? "keluar" : "masuk",
      tanggal: params.update.createdAt.toISOString(),
      createdAt: params.update.createdAt.toISOString(),
      barang: { kode: "-", nama: "Barang", satuan: "pcs" },
      gudang: { kode: "-", nama: "Gudang" },
      jumlah: 1,
      kondisi: "BARU",
      keterangan: params.message,
      user: params.update.user,
      fotoBukti: [] as unknown[],
    };
  }

  private buildMinimalMaterialDetail(params: {
    update: NonNullable<MaterialUpdateRecord>;
    message: string;
    isPickup: boolean;
    parsedMessage: MaterialMessageParseResult;
    updateId: string;
  }) {
    return {
      id: params.updateId,
      type: params.isPickup ? "keluar" : "masuk",
      tanggal: params.update.createdAt.toISOString(),
      createdAt: params.update.createdAt.toISOString(),
      barang: {
        kode: "-",
        nama: params.parsedMessage.namaBarang.trim(),
        satuan: params.parsedMessage.satuan,
      },
      gudang: { kode: "-", nama: "Gudang" },
      jumlah: params.parsedMessage.jumlah,
      kondisi: params.parsedMessage.kondisi,
      keterangan: params.message,
      user: params.update.user,
      fotoBukti: [] as unknown[],
    };
  }

  private findMatchingMaterial(
    sourceMaterials: MaterialSourceItem[],
    namaBarang: string,
  ) {
    const normalizedName = namaBarang.toLowerCase().trim();
    return sourceMaterials.find((material) => {
      const materialName = (material.nama || material.barang?.nama || "")
        .toLowerCase()
        .trim();
      return (
        materialName === normalizedName || materialName.includes(normalizedName)
      );
    });
  }

  private async findMaterialRelations(material: MaterialSourceItem) {
    const barangId = material.barangId || material.barang?.id;
    const gudangId = material.gudangId || material.gudang?.id;
    const [barang, gudang] = await Promise.all([
      barangId
        ? prisma.barang.findUnique({
            where: { id: barangId },
            select: { id: true, kode: true, nama: true, satuan: true },
          })
        : null,
      gudangId
        ? prisma.gudang.findUnique({
            where: { id: gudangId },
            select: { id: true, kode: true, nama: true },
          })
        : null,
    ]);

    return { barang, gudang };
  }

  private async findPickupDetail(
    materialId: string | undefined,
    isPickup: boolean,
  ) {
    if (!isPickup || !materialId) {
      return null;
    }

    return prisma.barangKeluar.findUnique({
      where: { id: materialId },
      include: {
        barang: { select: { kode: true, nama: true, satuan: true } },
        gudang: { select: { kode: true, nama: true } },
        user: { select: { name: true, email: true } },
      },
    });
  }
}
