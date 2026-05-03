import { logger } from "@/lib/logger";
/**
 * NOTE: PrismaClient type is intentionally kept here for transaction support.
 * This service needs PrismaClient type for $transaction operations.
 * Using DatabaseClient interface would require extensive type mapping.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import type { PrismaClient } from "@prisma/client";
import type { WorkOrderStatus } from "../types/work-order.enums";
import { InventoryStockService } from "@/modules/inventory";
import type {
  MobileWorkOrderMaterialInput,
  MobileWorkOrderMaterialResult,
  WorkOrderMaterialRepository,
} from "../repositories/WorkOrderMaterialRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  getWorkOrderErrorCode,
  isGenericNotFoundError,
  isMobileMaterialValidationError,
  resolveTenantIdFromContext,
} from "./work-order-service-helpers";
import { processMobileMaterialReturn } from "./work-order-mobile-material-return";
import {
  invalidateWorkOrderCaches,
  logMobileMaterialReturnActivity,
  notifyMobileWorkOrderMaterialActionSafely,
  notifyMobileWorkOrderMaterialReturnSafely,
} from "./work-order-side-effects";
import type {
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
} from "./work-order.material.types";
import type { ServiceResult, UserContext } from "./work-order.shared.types";
import {
  validateMobileWorkOrderMaterialAccess,
  validateMobileWorkOrderMaterialReturnAccess,
} from "./work-order-access";

interface WorkOrderMaterialDependencies {
  prismaClient: PrismaClient;
  repository: WorkOrderRepository;
  materialRepository: WorkOrderMaterialRepository;
  inventoryService: InventoryStockService;
}

/** Menangani operasi material work order. */
export class WorkOrderMaterialService {
  constructor(private readonly dependencies: WorkOrderMaterialDependencies) {}

  /** Tambah material dari admin/internal flow. */
  async addMaterial(
    workOrderId: string,
    barangId: string,
    quantity: number,
    userContext: UserContext,
    notes?: string,
    preferredGudangId?: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const material =
        await this.dependencies.materialRepository.addMaterialWithStockDeduction(
          workOrderId,
          barangId,
          quantity,
          userContext.id,
          notes ?? null,
          preferredGudangId,
        );
      return { success: true, data: material };
    } catch (error) {
      logger.error(
        "WorkOrderMaterialService.addMaterial failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menambahkan material",
        code: getWorkOrderErrorCode(error, "MATERIAL_ERROR"),
      };
    }
  }

  /** Tambah material dari mobile flow. */
  async addMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialResult[] }>> {
    try {
      const workOrder = await validateMobileWorkOrderMaterialAccess({
        repository: this.dependencies.repository,
        workOrderId,
        userContext,
      });
      const results =
        await this.dependencies.materialRepository.addMobileMaterialsWithStockDeduction(
          {
            workOrder: this.toMaterialWorkOrder(workOrder),
            items,
            actorId: userContext.id,
          },
        );
      await notifyMobileWorkOrderMaterialActionSafely({
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        actionType: "MATERIAL_PICKUP",
        actionMessage: this.buildMaterialSummary("Mengambil barang", results),
        triggeredByUserId: userContext.id,
        triggeredByName: triggeredByName || undefined,
        ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
        ...(workOrder.siteId && { siteId: workOrder.siteId }),
      });
      return { success: true, data: { items: results } };
    } catch (error) {
      return this.handleMobileMaterialError(error);
    }
  }

  /** Kembalikan material dari mobile flow. */
  async returnMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialReturnInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialReturnResult[] }>> {
    try {
      const workOrder = await validateMobileWorkOrderMaterialReturnAccess({
        repository: this.dependencies.repository,
        workOrderId,
        userContext,
      });
      const tenantId = resolveTenantIdFromContext({
        workOrderTenantId: workOrder.tenantId,
        userContext,
      });
      const results = await processMobileMaterialReturn({
        prismaClient: this.dependencies.prismaClient,
        inventoryService: this.dependencies.inventoryService,
        workOrder: this.toMaterialWorkOrder(workOrder),
        items,
        userContext,
        tenantId: tenantId || undefined,
      });
      await notifyMobileWorkOrderMaterialReturnSafely({
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        actionType: "MATERIAL_RETURN",
        actionMessage: this.buildMaterialSummary(
          "Mengembalikan barang",
          results,
        ),
        triggeredByUserId: userContext.id,
        triggeredByName: triggeredByName || undefined,
        ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
        ...(workOrder.siteId && { siteId: workOrder.siteId }),
      });
      logMobileMaterialReturnActivity({
        userId: userContext.id,
        tenantId: tenantId || undefined,
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        items: results,
      });
      await invalidateWorkOrderCaches();
      return { success: true, data: { items: results } };
    } catch (error) {
      return this.handleMobileMaterialError(error);
    }
  }

  /** Validasi akses mutasi material work order. */
  async validateWorkOrderAccess(workOrderId: string, userContext: UserContext) {
    return this.dependencies.repository
      .findById(workOrderId)
      .then((workOrder) => {
        if (!workOrder) {
          throw new Error("Work order tidak ditemukan");
        }
        return validateMobileWorkOrderMaterialAccess({
          repository: this.dependencies.repository,
          workOrderId,
          userContext,
        });
      });
  }

  private toMaterialWorkOrder(workOrder: {
    id: string;
    tenantId: string | null;
    workOrderNumber: string;
    title: string;
    status: string;
  }) {
    return {
      id: workOrder.id,
      tenantId: workOrder.tenantId,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status as WorkOrderStatus,
    };
  }

  private buildMaterialSummary(
    actionLabel: string,
    items: Array<{ nama: string; jumlah: number }>,
  ): string {
    const materialList = items
      .map((item) => `${item.nama} (${item.jumlah})`)
      .join(", ");
    return `${actionLabel}: ${materialList}`;
  }

  private handleMobileMaterialError<T>(error: unknown): ServiceResult<T> {
    logger.error(
      "WorkOrderMaterialService mobile material flow failed",
      error instanceof Error ? error : undefined,
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Terjadi kesalahan server",
      code:
        getWorkOrderErrorCode(error, "") ||
        (isMobileMaterialValidationError(error)
          ? "VALIDATION_ERROR"
          : isGenericNotFoundError(error)
            ? "NOT_FOUND"
            : "INTERNAL_ERROR"),
    };
  }
}
