import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type {
  CanvasingCompletionSummaryEntity,
  CanvasingEntity,
  CanvasingListSummaryEntity,
} from "../domain/entities/CanvasingEntity";
import type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingListFilters,
} from "../domain/ports/ICanvasingRepository";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
} from "../dto/MarketingDTO";
import type { WorkOrderQueryService } from "@/modules/work-order";
import { MarketingMapper } from "../mappers/MarketingMapper";
import { createNotification, notifyNewCanvasing } from "@/modules/notification";

const NORMAL_PRIORITY = "NORMAL" as const;
const INSTALLATION_TYPE = "INSTALLATION" as const;
const PENDING_STATUS = "PENDING" as const;
const APPROVED_STATUS = "APPROVED" as const;
const REJECTED_STATUS = "REJECTED" as const;

type CanvasingWorkOrderPort = Pick<
  WorkOrderQueryService,
  "generateWorkOrderNumber" | "create" | "addTask"
>;

export class CanvasingService {
  constructor(
    private readonly repository: ICanvasingRepository,
    private readonly woRepository: CanvasingWorkOrderPort,
  ) {}

  /** Create a canvasing request and return a response DTO. */
  async createRequest(data: CreateCanvasingInput): Promise<CanvasingDetailDTO> {
    const canvasing = await this.repository.create(data);
    this.notifyNewCanvasing(canvasing);
    return MarketingMapper.toCanvasingDetailDTO(canvasing);
  }

  /** Get canvasing detail by id. */
  async getRequestById(id: string): Promise<CanvasingDetailDTO | null> {
    const canvasing = await this.repository.findById(id);
    return canvasing ? MarketingMapper.toCanvasingDetailDTO(canvasing) : null;
  }

  /** Get canvasing entity with sales-site scope context. */
  async getRequestByIdWithSales(id: string): Promise<CanvasingEntity | null> {
    return this.repository.findByIdWithSales(id);
  }

  /** Get canvasing list and summary for API responses. */
  async getAllRequests(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    data: CanvasingListItemDTO[];
    total: number;
    summary: CanvasingListSummaryEntity;
  }> {
    const result = await this.repository.findAll(filters, page, limit);
    return {
      data: MarketingMapper.toCanvasingListDTO(result.data),
      total: result.total,
      summary: result.summary,
    };
  }

  /** Get scoped canvasing completion summary for API responses. */
  async getCompletionSummary(input: {
    canReadAll: boolean;
    userId: string;
  }): Promise<CanvasingCompletionSummaryEntity> {
    const now = new Date();
    const today = toStartOfDay(now);
    const tomorrow = this.addDays(today, 1);
    const weekStart = this.getWeekStart(today);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.repository.getCompletionSummary({
      salesId: input.canReadAll ? undefined : input.userId,
      today,
      tomorrow,
      weekStart,
      monthStart,
    });
  }

  /** Update canvasing detail and return a response DTO. */
  async updateRequest(
    id: string,
    data: UpdateCanvasingInput,
  ): Promise<CanvasingDetailDTO> {
    const canvasing = await this.repository.update(id, data);
    return MarketingMapper.toCanvasingDetailDTO(canvasing);
  }

  /** Approve canvasing, create work order, and return a response DTO. */
  async approveRequest(
    id: string,
    approverId: string,
  ): Promise<CanvasingDetailDTO> {
    const request = await this.getPendingCanvasingForApproval(id);
    const workOrder = await this.createWorkOrder(request, approverId);
    await this.createInstallationTasks(request, workOrder.id);
    const approved = await this.repository.update(id, {
      status: APPROVED_STATUS,
      approvedBy: approverId,
      approvedAt: new Date(),
      workOrderId: workOrder.id,
    });
    this.notifyApprovedCanvasing(request, id, workOrder.workOrderNumber);
    return MarketingMapper.toCanvasingDetailDTO(approved);
  }

  /** Reject canvasing and return a response DTO. */
  async rejectRequest(id: string): Promise<CanvasingDetailDTO> {
    const request = await this.requireCanvasing(id);
    this.ensurePendingStatus(request.status, "ditolak");
    const rejected = await this.repository.update(id, {
      status: REJECTED_STATUS,
    });
    this.notifyRejectedCanvasing(request, id);
    return MarketingMapper.toCanvasingDetailDTO(rejected);
  }

  /** Delete a canvasing request. */
  async deleteRequest(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /** Cancel approved canvasing and return a response DTO. */
  async cancelApproval(id: string): Promise<CanvasingDetailDTO> {
    const request = await this.requireCanvasing(id);
    if (request.status !== APPROVED_STATUS) {
      throw new Error("Hanya canvasing APPROVED yang bisa dibatalkan");
    }

    const updated = await this.repository.update(id, {
      status: PENDING_STATUS,
      workOrderId: null,
      approvedBy: null,
      approvedAt: null,
    });
    return MarketingMapper.toCanvasingDetailDTO(updated);
  }

  private getWeekStart(today: Date): Date {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    return weekStart;
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private async getPendingCanvasingForApproval(id: string) {
    const request = await this.repository.findByIdWithSales(id);
    if (!request) {
      throw new Error("Request tidak ditemukan");
    }

    this.ensurePendingStatus(request.status, "disetujui");
    return request;
  }

  private ensurePendingStatus(status: string, action: string): void {
    if (status === PENDING_STATUS) {
      return;
    }

    throw new Error(`Hanya request PENDING yang bisa ${action}`);
  }

  private async requireCanvasing(id: string): Promise<CanvasingEntity> {
    const request = await this.repository.findById(id);
    if (request) {
      return request;
    }

    throw new Error("Request tidak ditemukan");
  }

  private async createWorkOrder(request: CanvasingEntity, approverId: string) {
    const workOrderNumber = await this.woRepository.generateWorkOrderNumber();
    const siteId = request.user?.siteId ?? request.mitra?.siteId ?? undefined;
    return this.woRepository.create({
      workOrderNumber,
      title: `Instalasi Baru - ${request.nama}`,
      description: this.buildWorkOrderDescription(request),
      priority: NORMAL_PRIORITY,
      type: INSTALLATION_TYPE,
      ...(siteId ? { siteId } : {}),
      contactName: request.nama,
      contactPhone: request.noTelpon,
      locationAddress: request.alamat,
      ...(request.latitude ? { locationLat: request.latitude } : {}),
      ...(request.longitude ? { locationLng: request.longitude } : {}),
      createdById: approverId,
    });
  }

  private buildWorkOrderDescription(request: CanvasingEntity): string {
    return [
      "Canvasing Approved",
      `Pelanggan: ${request.nama}`,
      `Paket: ${request.paket}`,
      request.odp ? `ODP: ${request.odp}` : null,
    ]
      .filter(Boolean)
      .join(". ");
  }

  private async createInstallationTasks(
    request: CanvasingEntity,
    workOrderId: string,
  ): Promise<void> {
    const tasks = this.buildInstallationTasks(request);
    for (const task of tasks) {
      await this.woRepository.addTask({ workOrderId, ...task });
    }
  }

  private buildInstallationTasks(request: CanvasingEntity) {
    const baseTasks = [
      {
        title: `Kabel ${request.kabel} meter`,
        description: "Tarik kabel dari ODP ke rumah pelanggan",
        order: 1,
      },
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
    ];

    if (!request.sn) {
      return baseTasks;
    }

    return [
      baseTasks[0],
      {
        title: `SN ONT: ${request.sn}`,
        description: "Pasang ONT dengan SN yang sudah ditentukan",
        order: 2,
      },
      ...baseTasks.slice(1),
    ];
  }

  private notifyNewCanvasing(canvasing: CanvasingEntity): void {
    notifyNewCanvasing({
      canvasingId: canvasing.id,
      customerName: canvasing.nama,
      salesId: canvasing.salesId,
      salesName: canvasing.user?.name || canvasing.mitra?.name || undefined,
      siteId: canvasing.user?.siteId || canvasing.mitra?.siteId,
    }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
  }

  private notifyApprovedCanvasing(
    request: CanvasingEntity,
    canvasingId: string,
    workOrderNumber: string,
  ): void {
    if (!request.salesId) {
      return;
    }

    createNotification({
      type: "ANNOUNCEMENT",
      priority: NORMAL_PRIORITY,
      title: "✅ Canvasing Disetujui",
      message: `Canvasing untuk ${request.nama} disetujui. WO #${workOrderNumber} telah dibuat.`,
      link: `/admin/marketing/canvasing/${canvasingId}`,
      userId: request.salesId,
      sourceType: "CANVASING",
      sourceId: canvasingId,
    }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
  }

  private notifyRejectedCanvasing(
    request: CanvasingEntity,
    canvasingId: string,
  ): void {
    if (!request.salesId) {
      return;
    }

    createNotification({
      type: "ANNOUNCEMENT",
      priority: NORMAL_PRIORITY,
      title: "❌ Canvasing Ditolak",
      message: `Canvasing untuk ${request.nama} ditolak.`,
      link: `/admin/marketing/canvasing/${canvasingId}`,
      userId: request.salesId,
      sourceType: "CANVASING",
      sourceId: canvasingId,
    }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
  }
}
