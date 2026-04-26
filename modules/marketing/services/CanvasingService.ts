import type { Canvasing } from "@prisma/client";
import type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingWithSalesInfo,
  CanvasingListFilters,
  CanvasingListSummary,
} from "../repositories/ICanvasingRepository";
import type { IWorkOrderRepository } from "../../work-order/repositories/IWorkOrderRepository";
import {
  createNotification,
  notifyNewCanvasing,
} from "../../notification/services/NotificationService";

export class CanvasingService {
  constructor(
    private readonly repository: ICanvasingRepository,
    private readonly woRepository: IWorkOrderRepository,
  ) {}

  async createRequest(
    data: CreateCanvasingInput,
  ): Promise<CanvasingWithSalesInfo> {
    const canvasing = await this.repository.create(data);

    // Notify admins/managers with canvasing:verify permission
    notifyNewCanvasing({
      canvasingId: canvasing.id,
      customerName: canvasing.nama,
      salesId: canvasing.salesId,
      salesName: canvasing.user?.name || canvasing.mitra?.name || undefined,
      siteId: canvasing.user?.siteId || canvasing.mitra?.siteId,
    }).catch((err) => console.error("[Canvasing Notif] Error:", err));

    return canvasing;
  }

  async getRequestById(id: string): Promise<Canvasing | null> {
    return this.repository.findById(id);
  }

  async getRequestByIdWithSales(id: string) {
    return this.repository.findByIdWithSales(id);
  }

  async getAllRequests(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    data: Canvasing[];
    total: number;
    summary: CanvasingListSummary;
  }> {
    return this.repository.findAll(filters, page, limit);
  }

  async updateRequest(
    id: string,
    data: UpdateCanvasingInput,
  ): Promise<Canvasing> {
    return this.repository.update(id, data);
  }

  async approveRequest(id: string, approverId: string): Promise<Canvasing> {
    // Use findByIdWithSales to get sales user with site info
    const request = await this.repository.findByIdWithSales(id);
    if (!request) throw new Error("Request tidak ditemukan");
    if (request.status !== "PENDING")
      throw new Error("Hanya request PENDING yang bisa disetujui");

    // 1. Generate WO Number
    const woNumber = await this.woRepository.generateWorkOrderNumber();

    // 2. Build description with all details
    const descriptionParts = [
      `Canvasing Approved`,
      `Pelanggan: ${request.nama}`,
      `Paket: ${request.paket}`,
      request.odp ? `ODP: ${request.odp}` : null,
    ].filter(Boolean);

    // 3. Create Work Order with full data
    const workOrder = await this.woRepository.create({
      workOrderNumber: woNumber,
      title: `Instalasi Baru - ${request.nama}`,
      description: descriptionParts.join(". "),
      priority: "NORMAL",
      type: "INSTALLATION",
      // Site from sales user
      ...(request.user?.siteId
        ? { siteId: request.user.siteId }
        : request.mitra?.siteId
          ? { siteId: request.mitra.siteId }
          : {}),
      // Contact info
      contactName: request.nama,
      contactPhone: request.noTelpon,
      // Location
      locationAddress: request.alamat,
      ...(request.latitude ? { locationLat: request.latitude } : {}),
      ...(request.longitude ? { locationLng: request.longitude } : {}),
      createdById: approverId,
    });

    // 4. Create Tasks Checklist
    const tasks = [
      {
        title: `Kabel ${request.kabel} meter`,
        description: "Tarik kabel dari ODP ke rumah pelanggan",
        order: 1,
      },
    ];

    // Add SN ONT task if SN provided
    if (request.sn) {
      tasks.push({
        title: `SN ONT: ${request.sn}`,
        description: "Pasang ONT dengan SN yang sudah ditentukan",
        order: 2,
      });
    }

    // Standard installation tasks
    tasks.push(
      {
        title: "Pasang Modem/Router",
        description: "Setting dan pasang perangkat CPE",
        order: request.sn ? 3 : 2,
      },
      {
        title: "Test Koneksi",
        description: "Verifikasi koneksi internet berjalan dengan baik",
        order: request.sn ? 4 : 3,
      },
    );

    // Create all tasks
    for (const task of tasks) {
      await this.woRepository.addTask({
        workOrderId: workOrder.id,
        ...task,
      });
    }

    // 5. Update Canvasing status
    const approved = await this.repository.update(id, {
      status: "APPROVED",
      approvedBy: approverId,
      approvedAt: new Date(),
      workOrderId: workOrder.id,
    });

    // 6. Notify sales that canvasing was approved
    if (request.salesId) {
      createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "✅ Canvasing Disetujui",
        message: `Canvasing untuk ${request.nama} disetujui. WO #${woNumber} telah dibuat.`,
        link: `/admin/marketing/canvasing/${id}`,
        userId: request.salesId,
        sourceType: "CANVASING",
        sourceId: id,
      }).catch((err) => console.error("[Canvasing Notif] Error:", err));
    }

    return approved;
  }

  async rejectRequest(id: string): Promise<Canvasing> {
    const request = await this.repository.findById(id);
    if (!request) throw new Error("Request tidak ditemukan");
    if (request.status !== "PENDING") {
      throw new Error("Hanya request PENDING yang bisa ditolak");
    }

    const rejected = await this.repository.update(id, { status: "REJECTED" });

    if (request.salesId) {
      createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "❌ Canvasing Ditolak",
        message: `Canvasing untuk ${request.nama} ditolak.`,
        link: `/admin/marketing/canvasing/${id}`,
        userId: request.salesId,
        sourceType: "CANVASING",
        sourceId: id,
      }).catch((err) => console.error("[Canvasing Notif] Error:", err));
    }

    return rejected;
  }

  async deleteRequest(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async cancelApproval(id: string): Promise<Canvasing> {
    const request = await this.repository.findById(id);
    if (!request) throw new Error("Request tidak ditemukan");
    if (request.status !== "APPROVED")
      throw new Error("Hanya canvasing APPROVED yang bisa dibatalkan");

    // Reset to PENDING and unlink from WO
    return this.repository.update(id, {
      status: "PENDING",
      workOrderId: null,
      approvedBy: null,
      approvedAt: null,
    });
  }
}
