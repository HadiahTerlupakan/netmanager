import type { PrismaClient } from "@prisma/client";
import type { WorkOrderStatus } from "../types/work-order.enums";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { UserLookupService } from "@/modules/users";
import { InventoryStockService } from "@/modules/inventory";

import type { WorkOrderWithRelations } from "../repositories/IWorkOrderRepository";
import {
  WorkOrderMaterialRepository,
  type MobileWorkOrderMaterialInput,
  type MobileWorkOrderMaterialResult,
} from "../repositories/WorkOrderMaterialRepository";
import {
  TicketRepository,
  WorkOrderTemplateRepository,
  WarrantyCheckRepository,
} from "../repositories/WorkOrderSupportRepositories";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { WorkOrderActivityService } from "./WorkOrderActivityService";
import { WorkOrderMaterialService } from "./WorkOrderMaterialService";
import { WorkOrderMutationService } from "./WorkOrderMutationService";
import { WorkOrderReadService } from "./WorkOrderReadService";
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
  private readonly repository: WorkOrderRepository;
  private readonly activityService: WorkOrderActivityService;
  private readonly mutationService: WorkOrderMutationService;
  private readonly readService: WorkOrderReadService;
  private readonly materialService: WorkOrderMaterialService;

  constructor(prismaClient?: PrismaClient) {
    const client = prismaClient ?? defaultPrisma;
    const repository = this.createRepository(client);
    const materialRepository = this.createMaterialRepository(client);

    this.repository = repository;
    this.activityService = this.createActivityService(repository);
    this.readService = this.createReadService(repository);
    this.materialService = this.createMaterialService(
      client,
      repository,
      materialRepository,
    );
    this.mutationService = this.createMutationService(repository);
    this.initializeTemplateRepository();
  }

  /** Buat repository utama work order. */
  private createRepository(prismaClient: PrismaClient): WorkOrderRepository {
    return new WorkOrderRepository(prismaClient);
  }

  /** Buat repository material work order. */
  private createMaterialRepository(
    prismaClient: PrismaClient,
  ): WorkOrderMaterialRepository {
    return new WorkOrderMaterialRepository(prismaClient);
  }

  /** Buat service aktivitas work order. */
  private createActivityService(
    repository: WorkOrderRepository,
  ): WorkOrderActivityService {
    return new WorkOrderActivityService(repository);
  }

  /** Buat service baca work order. */
  private createReadService(
    repository: WorkOrderRepository,
  ): WorkOrderReadService {
    return new WorkOrderReadService(repository);
  }

  /** Buat service mutasi material work order. */
  private createMaterialService(
    prismaClient: PrismaClient,
    repository: WorkOrderRepository,
    materialRepository: WorkOrderMaterialRepository,
  ): WorkOrderMaterialService {
    return new WorkOrderMaterialService({
      prismaClient,
      repository,
      materialRepository,
      inventoryService: new InventoryStockService(),
    });
  }

  /** Buat service mutasi work order. */
  private createMutationService(
    repository: WorkOrderRepository,
  ): WorkOrderMutationService {
    return new WorkOrderMutationService({
      repository,
      userRepo: new UserLookupService(),
      ticketRepo: new TicketRepository(),
      warrantyRepo: new WarrantyCheckRepository(),
    });
  }

  /** Inisialisasi repository template demi menjaga side effect existing. */
  private initializeTemplateRepository(): void {
    new WorkOrderTemplateRepository();
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
