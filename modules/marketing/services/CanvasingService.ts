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
  FindAllCanvasingOptions,
} from "../domain/ports/ICanvasingRepository";
import type {
  CanvasingDetailDTO,
  CanvasingListItemDTO,
} from "../dto/MarketingDTO";
import type { WorkOrderQueryService } from "@/modules/work-order";
import { MarketingError } from "../domain/errors/MarketingError";
import { MarketingMapper } from "../mappers/MarketingMapper";
import {
  notifyApprovedCanvasing,
  notifyCreatedCanvasing,
  notifyRejectedCanvasing,
} from "./canvasing.notifications";
import {
  APPROVED_STATUS,
  buildCompletionSummaryRange,
  buildInstallationTasks,
  buildWorkOrderCreateInput,
  ensurePendingCanvasingStatus,
  PENDING_STATUS,
  REJECTED_STATUS,
  requireCanvasing,
  requirePendingCanvasingForApproval,
} from "./canvasing.service.helpers";

type CanvasingWorkOrderPort = Pick<
  WorkOrderQueryService,
  "generateWorkOrderNumber" | "create" | "addTask" | "delete" | "cancel"
>;

export class CanvasingService {
  constructor(
    private readonly repository: ICanvasingRepository,
    private readonly woRepository: CanvasingWorkOrderPort,
  ) {}

  /** Create a canvasing request and return a response DTO. */
  async createRequest(data: CreateCanvasingInput): Promise<CanvasingDetailDTO> {
    const canvasing = await this.repository.create(data);
    notifyCreatedCanvasing(canvasing);
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
    options?: FindAllCanvasingOptions,
  ): Promise<{
    data: CanvasingListItemDTO[];
    total: number;
    summary: CanvasingListSummaryEntity;
    nextCursor?: string | null;
  }> {
    const result = await this.repository.findAll(filters, page, limit, options);
    return {
      data: MarketingMapper.toCanvasingListDTO(result.data),
      total: result.total,
      summary: result.summary,
      nextCursor: result.nextCursor ?? null,
    };
  }

  /** Get scoped canvasing completion summary for API responses. */
  async getCompletionSummary(input: {
    canReadAll: boolean;
    userId: string;
  }): Promise<CanvasingCompletionSummaryEntity> {
    const range = buildCompletionSummaryRange(new Date());

    return this.repository.getCompletionSummary({
      salesId: input.canReadAll ? undefined : input.userId,
      today: range.today,
      tomorrow: range.tomorrow,
      weekStart: range.weekStart,
      monthStart: range.monthStart,
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

  /**
   * Approve canvasing, create work order, dan return DTO.
   *
   * Why: operasi mencakup dua domain (work-order & marketing) sehingga tidak
   * mungkin satu prisma transaction. Pola yang dipakai: bila canvasing.update
   * gagal setelah WO terbuat, jalankan kompensasi (delete WO) agar tidak ada
   * orphan WO. Tasks dibuat setelah update sukses untuk memastikan invariant
   * status canvasing+workOrderId konsisten dulu.
   */
  async approveRequest(
    id: string,
    approverId: string,
  ): Promise<CanvasingDetailDTO> {
    const request = await requirePendingCanvasingForApproval(
      this.repository,
      id,
    );
    const workOrderNumber = await this.woRepository.generateWorkOrderNumber();
    const workOrderInput = await buildWorkOrderCreateInput(
      request,
      approverId,
      workOrderNumber,
    );
    const workOrder = await this.woRepository.create(workOrderInput);

    let approved;
    try {
      approved = await this.repository.update(id, {
        status: APPROVED_STATUS,
        approvedBy: approverId,
        approvedAt: new Date(),
        workOrderId: workOrder.id,
      });
    } catch (error) {
      await this.woRepository.delete(workOrder.id).catch((): void => undefined);
      throw error;
    }

    await Promise.all(
      buildInstallationTasks(request).map((task) =>
        this.woRepository.addTask({ workOrderId: workOrder.id, ...task }),
      ),
    );
    notifyApprovedCanvasing(request, id, workOrder.workOrderNumber);

    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus.publish(EVENT_NAMES.MARKETING_CANVASING_APPROVED, {
      canvasingId: approved.id,
      salesId: approved.salesId ?? null,
      approverId: approverId,
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      prospectName: approved.nama,
      approvedAt: (approved.approvedAt ?? new Date()).toISOString(),
      triggeredBy: approverId,
    });

    return MarketingMapper.toCanvasingDetailDTO(approved);
  }

  /** Reject canvasing and return a response DTO. */
  async rejectRequest(id: string): Promise<CanvasingDetailDTO> {
    const request = await requireCanvasing(this.repository, id);
    ensurePendingCanvasingStatus(request.status, "ditolak");
    const rejected = await this.repository.update(id, {
      status: REJECTED_STATUS,
    });
    notifyRejectedCanvasing(request, id);
    return MarketingMapper.toCanvasingDetailDTO(rejected);
  }

  /** Delete a canvasing request. */
  async deleteRequest(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /** Cancel approval canvasing dan cancel WO terkait. */
  async cancelApproval(
    id: string,
    cancelledById?: string,
  ): Promise<CanvasingDetailDTO> {
    const request = await requireCanvasing(this.repository, id);
    if (request.status !== APPROVED_STATUS) {
      throw new MarketingError(
        "invalid_status",
        "Hanya canvasing APPROVED yang bisa dibatalkan",
      );
    }

    const previousWorkOrderId = request.workOrderId;
    const updated = await this.repository.update(id, {
      status: PENDING_STATUS,
      workOrderId: null,
      approvedBy: null,
      approvedAt: null,
    });

    if (previousWorkOrderId) {
      await this.woRepository
        .cancel(
          previousWorkOrderId,
          `Canvasing #${id} approval dibatalkan`,
          cancelledById,
        )
        .catch((): void => undefined);
    }

    return MarketingMapper.toCanvasingDetailDTO(updated);
  }
}
