/**
 * NOTE: PrismaClient type is intentionally kept here for transaction support.
 * This service orchestrates complex operations requiring database transactions.
 * Using DatabaseClient interface would require extensive type mapping.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import type { PrismaClient } from "@prisma/client";
import type { WorkOrderStatus } from "../types/work-order.enums";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type {
  MobileWorkOrderMaterialInput,
  MobileWorkOrderMaterialResult,
} from "../repositories/WorkOrderMaterialRepository";
import { WorkOrderActivityService } from "./WorkOrderActivityService";
import { WorkOrderMaterialService } from "./WorkOrderMaterialService";
import { WorkOrderMutationService } from "./WorkOrderMutationService";
import { WorkOrderReadService } from "./WorkOrderReadService";
import {
  buildWorkOrderServiceDependencies,
  initializeWorkOrderTemplateRepository,
} from "./work-order-service.factory";
import type {
  CreateWorkOrderInput,
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  ServiceResult,
  UpdateWorkOrderInput,
  UserContext,
  WorkOrderListOptions,
} from "./work-order-service.contracts";

export type {
  CreateWorkOrderInput,
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  ServiceResult,
  UpdateWorkOrderInput,
  UserContext,
  WorkOrderListOptions,
} from "./work-order-service.contracts";

/** Menjadi facade tipis untuk orkestrasi work order. */
export class WorkOrderService {
  private readonly activityService: WorkOrderActivityService;
  private readonly mutationService: WorkOrderMutationService;
  private readonly readService: WorkOrderReadService;
  private readonly materialService: WorkOrderMaterialService;

  constructor(prismaClient?: PrismaClient) {
    const dependencies = buildWorkOrderServiceDependencies(prismaClient);
    this.activityService = dependencies.activityService;
    this.readService = dependencies.readService;
    this.materialService = dependencies.materialService;
    this.mutationService = dependencies.mutationService;
    initializeWorkOrderTemplateRepository();
  }

  /** Ambil daftar work order terpaginasi. */
  async getWorkOrders(options: WorkOrderListOptions) {
    return this.readService.getWorkOrders(options);
  }

  /** Ambil daftar request work order. */
  async getWorkOrderRequests(
    filters: { departmentId?: string; siteId?: string; search?: string },
    page = 1,
    limit = 20,
  ) {
    return this.readService.getWorkOrderRequests(filters, page, limit);
  }

  /** Ambil statistik work order. */
  async getStatistics(filters: {
    departmentId?: string;
    siteId?: string;
    assignedToId?: string;
  }) {
    return this.readService.getStatistics(filters);
  }

  /** Ambil work order terbaru. */
  async getRecentWorkOrders(limit = 5, filters: { departmentId?: string }) {
    return this.readService.getRecentWorkOrders(limit, filters);
  }

  /** Ambil detail work order. */
  async getWorkOrderById(id: string, userContext?: UserContext) {
    return this.readService.getWorkOrderById(id, userContext);
  }

  /** Buat work order baru. */
  async createWorkOrder(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    return this.mutationService.createWorkOrder(input, userContext);
  }

  /** Perbarui work order. */
  async updateWorkOrder(
    id: string,
    input: UpdateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    return this.mutationService.updateWorkOrder(id, input, userContext);
  }

  /** Perbarui status work order. */
  async updateStatus(
    id: string,
    status: WorkOrderStatus,
    userContext: UserContext,
    resolutionNotes?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    return this.mutationService.updateStatus(
      id,
      status,
      userContext,
      resolutionNotes,
    );
  }

  /** Tugaskan work order ke karyawan. */
  async assignWorkOrder(
    id: string,
    employeeId: string,
    userContext: UserContext,
    role?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    return this.mutationService.assignWorkOrder(
      id,
      employeeId,
      userContext,
      role,
    );
  }

  /** Setujui request work order. */
  async approveRequest(id: string, userContext: UserContext) {
    return this.mutationService.approveRequest(id, userContext);
  }

  /** Tolak request work order. */
  async rejectRequest(id: string, userContext: UserContext, reason: string) {
    return this.mutationService.rejectRequest(id, userContext, reason);
  }

  /** Hapus work order. */
  async deleteWorkOrder(id: string, userContext: UserContext) {
    return this.mutationService.deleteWorkOrder(id, userContext);
  }

  /** Tambah material ke work order. */
  async addMaterial(
    workOrderId: string,
    barangId: string,
    quantity: number,
    userContext: UserContext,
    notes?: string,
    preferredGudangId?: string,
  ) {
    return this.materialService.addMaterial(
      workOrderId,
      barangId,
      quantity,
      userContext,
      notes,
      preferredGudangId,
    );
  }

  /** Tambah material dari mobile app. */
  async addMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialResult[] }>> {
    return this.materialService.addMobileMaterials(
      workOrderId,
      items,
      userContext,
      triggeredByName,
    );
  }

  /** Kembalikan material dari mobile app. */
  async returnMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialReturnInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialReturnResult[] }>> {
    return this.materialService.returnMobileMaterials(
      workOrderId,
      items,
      userContext,
      triggeredByName,
    );
  }

  /** Tambahkan komentar ke work order. */
  async addComment(
    workOrderId: string,
    message: string,
    userContext: UserContext,
  ) {
    return this.activityService.addComment(workOrderId, message, userContext);
  }

  /** Tambahkan task ke work order. */
  async addTask(
    workOrderId: string,
    taskData: { title: string; description?: string; order?: number },
    userContext: UserContext,
  ) {
    return this.activityService.addTask(workOrderId, taskData, userContext);
  }

  /** Tambahkan lampiran ke work order. */
  async addAttachment(
    workOrderId: string,
    data: {
      fileName: string;
      filePath: string;
      fileSize: number;
      fileType: string;
      caption?: string;
    },
    userContext: UserContext,
  ) {
    return this.activityService.addAttachment(workOrderId, data, userContext);
  }

  /** Hapus lampiran dari work order. */
  async deleteAttachment(
    workOrderId: string,
    attachmentId: string,
    userContext: UserContext,
  ) {
    return this.activityService.deleteAttachment(
      workOrderId,
      attachmentId,
      userContext,
    );
  }
}

let workOrderServiceInstance: WorkOrderService | null = null;

/** Ambil singleton WorkOrderService. */
export function getWorkOrderService(): WorkOrderService {
  workOrderServiceInstance ??= new WorkOrderService();
  return workOrderServiceInstance;
}
