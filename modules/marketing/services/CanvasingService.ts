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

  /** Approve canvasing, create work order, and return a response DTO. */
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

    await Promise.all(
      buildInstallationTasks(request).map((task) =>
        this.woRepository.addTask({ workOrderId: workOrder.id, ...task }),
      ),
    );

    const approved = await this.repository.update(id, {
      status: APPROVED_STATUS,
      approvedBy: approverId,
      approvedAt: new Date(),
      workOrderId: workOrder.id,
    });
    notifyApprovedCanvasing(request, id, workOrder.workOrderNumber);
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

  /** Cancel approved canvasing and return a response DTO. */
  async cancelApproval(id: string): Promise<CanvasingDetailDTO> {
    const request = await requireCanvasing(this.repository, id);
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
}
