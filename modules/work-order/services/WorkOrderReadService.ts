import { logger } from "@/lib/logger";
import type { WorkOrderListSummary } from "../domain/entities/WorkOrderRepositoryTypes";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  applyWorkOrderListRestrictions,
  createEmptyWorkOrderListResult,
} from "./work-order-service-helpers";
import type { WorkOrderListOptions } from "./work-order.query.types";
import type { ServiceResult, UserContext } from "./work-order.shared.types";
import type { WorkOrderWithRelations } from "../domain/entities/WorkOrderRepositoryTypes";
import { validateWorkOrderAccess as validateWorkOrderAccessHelper } from "./work-order-access";

/** Menangani query baca work order. */
export class WorkOrderReadService {
  constructor(private readonly repository: WorkOrderRepository) {}

  /** Ambil daftar work order terpaginasi. */
  async getWorkOrders(options: WorkOrderListOptions): Promise<
    ServiceResult<{
      workOrders: unknown[];
      total: number;
      page: number;
      totalPages: number;
      summary: WorkOrderListSummary;
    }>
  > {
    try {
      const page = options.page ?? 1;
      const limit = options.limit ?? 20;
      const appliedFilters = applyWorkOrderListRestrictions({
        filters: options.filters ?? {},
        userPermissions: options.userPermissions,
        userDepartmentId: options.userDepartmentId,
        userSiteId: options.userSiteId,
        userRole: options.userRole,
      });

      if (!appliedFilters) {
        return createEmptyWorkOrderListResult(page);
      }

      const result = await this.repository.findAllForList(
        appliedFilters,
        page,
        limit,
      );
      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "WorkOrderReadService.getWorkOrders failed",
        error instanceof Error ? error : undefined,
      );
      return this.fetchError("Gagal mengambil daftar work order");
    }
  }

  /** Ambil daftar request work order. */
  async getWorkOrderRequests(
    filters: { departmentId?: string; siteId?: string; search?: string },
    page = 1,
    limit = 20,
  ): Promise<
    ServiceResult<{
      workOrders: unknown[];
      total: number;
      page: number;
      totalPages: number;
    }>
  > {
    try {
      const result = await this.repository.findAllRequests(
        filters,
        page,
        limit,
      );
      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "WorkOrderReadService.getWorkOrderRequests failed",
        error instanceof Error ? error : undefined,
      );
      return this.fetchError("Gagal mengambil daftar permintaan work order");
    }
  }

  /** Ambil statistik work order. */
  async getStatistics(filters: {
    departmentId?: string;
    siteId?: string;
    assignedToId?: string;
  }): Promise<ServiceResult<unknown>> {
    try {
      return {
        success: true,
        data: await this.repository.getStatistics(filters),
      };
    } catch (error) {
      logger.error(
        "WorkOrderReadService.getStatistics failed",
        error instanceof Error ? error : undefined,
      );
      return this.fetchError("Gagal mengambil statistik");
    }
  }

  /** Ambil daftar work order terbaru. */
  async getRecentWorkOrders(
    limit = 5,
    filters: { departmentId?: string },
  ): Promise<ServiceResult<unknown[]>> {
    try {
      const workOrders = await this.repository.getRecentWorkOrders(
        limit,
        filters,
      );
      return { success: true, data: workOrders };
    } catch (error) {
      logger.error(
        "WorkOrderReadService.getRecentWorkOrders failed",
        error instanceof Error ? error : undefined,
      );
      return this.fetchError("Gagal mengambil work order terbaru");
    }
  }

  /** Ambil detail work order tunggal. */
  async getWorkOrderById(
    id: string,
    userContext?: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      const workOrder = userContext
        ? await this.validateWorkOrderAccess(id, userContext)
        : await this.repository.findById(id);
      if (!workOrder) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return { success: true, data: workOrder };
    } catch (error) {
      logger.error(
        "WorkOrderReadService.getWorkOrderById failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengambil work order",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "FETCH_ERROR",
      };
    }
  }

  /** Validasi akses baca work order. */
  async validateWorkOrderAccess(
    workOrderId: string,
    userContext: UserContext,
  ): Promise<WorkOrderWithRelations | null> {
    return validateWorkOrderAccessHelper({
      repository: this.repository,
      workOrderId,
      userContext,
    });
  }

  private fetchError<T>(message: string): ServiceResult<T> {
    return { success: false, error: message, code: "FETCH_ERROR" };
  }
}
