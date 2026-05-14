import { logger, logActivitySafe } from "@/lib/logger";
import { randomUUID } from "crypto";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  DepartmentDetailDTO,
  DepartmentListItemDTO,
} from "../dto/DepartmentDTO";
import type { DepartmentEntity } from "../domain/entities/DepartmentEntity";
import type {
  CreateDepartmentRepositoryInput,
  IDepartmentRepository,
  UpdateDepartmentRepositoryInput,
} from "../domain/ports/IDepartmentRepository";
import { createDepartmentRepository } from "../factories/RepositoryFactory";
import { DepartmentMapper } from "../mappers/DepartmentMapper";
import type {
  CreateDepartmentData,
  DepartmentFilters,
  ServiceResult,
  UpdateDepartmentData,
} from "./department-service.types";

export class DepartmentService {
  private readonly departmentRepo: IDepartmentRepository;

  constructor(
    departmentRepo: IDepartmentRepository = createDepartmentRepository(),
  ) {
    this.departmentRepo = departmentRepo;
  }

  /** Get all departments as list DTOs. */
  async getDepartments(
    filters: DepartmentFilters = {},
  ): Promise<ServiceResult<DepartmentListItemDTO[]>> {
    try {
      const departments = await this.departmentRepo.findAll(filters);
      return {
        success: true,
        data: DepartmentMapper.toListItemDTOs(departments),
      };
    } catch (error) {
      logger.error(
        "DepartmentService.getDepartments failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil daftar departemen",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Get department detail DTO by ID. */
  async getDepartmentById(
    id: string,
  ): Promise<ServiceResult<DepartmentDetailDTO>> {
    try {
      const department = await this.departmentRepo.findById(id);
      if (!department) {
        return {
          success: false,
          error: "Departemen tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return { success: true, data: DepartmentMapper.toDetailDTO(department) };
    } catch (error) {
      logger.error(
        "DepartmentService.getDepartmentById failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil departemen",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Create new department and return detail DTO. */
  async createDepartment(
    data: CreateDepartmentData,
    createdById: string,
  ): Promise<ServiceResult<DepartmentDetailDTO>> {
    try {
      if (!data.name) {
        return {
          success: false,
          error: "Nama wajib diisi",
          code: "VALIDATION_ERROR",
        };
      }

      const existing = await this.departmentRepo.findByName(data.name);
      if (existing) {
        return {
          success: false,
          error: "Nama departemen sudah digunakan",
          code: "DUPLICATE_NAME",
        };
      }

      const department = await this.departmentRepo.create(
        this.buildCreateInput(data),
      );
      this.logActivity("CREATE", "Department", createdById, {
        id: department.id,
        name: department.name,
      });
      return { success: true, data: DepartmentMapper.toDetailDTO(department) };
    } catch (error) {
      logger.error(
        "DepartmentService.createDepartment failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal membuat departemen",
        code: "CREATE_ERROR",
      };
    }
  }

  /** Update department and return detail DTO. */
  async updateDepartment(
    id: string,
    data: UpdateDepartmentData,
    updatedById: string,
  ): Promise<ServiceResult<DepartmentDetailDTO>> {
    try {
      const existing = await this.departmentRepo.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Departemen tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      const duplicate = await this.findDuplicateName(data.name, existing);
      if (duplicate) {
        return {
          success: false,
          error: "Nama departemen sudah digunakan",
          code: "DUPLICATE_NAME",
        };
      }

      const department = await this.departmentRepo.update(
        id,
        this.buildUpdateInput(data),
      );
      this.logActivity("UPDATE", "Department", updatedById, {
        id: department.id,
        updates: data,
      });
      return { success: true, data: DepartmentMapper.toDetailDTO(department) };
    } catch (error) {
      logger.error(
        "DepartmentService.updateDepartment failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengupdate departemen",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Delete department by ID. */
  async deleteDepartment(
    id: string,
    deletedById: string,
  ): Promise<ServiceResult<void>> {
    try {
      const department = await this.departmentRepo.findByIdWithCounts(id);
      if (!department) {
        return {
          success: false,
          error: "Departemen tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      const deletionError = this.getDeletionError(department);
      if (deletionError) {
        return deletionError;
      }

      await this.departmentRepo.delete(id);
      this.logActivity("DELETE", "Department", deletedById, {
        id,
        name: department.name,
      });
      return { success: true };
    } catch (error) {
      logger.error(
        "DepartmentService.deleteDepartment failed",
        error instanceof Error ? error : undefined,
      );
      if (isPrismaRecordNotFoundError(error)) {
        return {
          success: false,
          error: "Departemen tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return {
        success: false,
        error: "Gagal menghapus departemen",
        code: "DELETE_ERROR",
      };
    }
  }

  private buildCreateInput(
    data: CreateDepartmentData,
  ): CreateDepartmentRepositoryInput {
    return {
      id: randomUUID(),
      name: data.name,
      description: data.description || null,
      jobDescription: data.jobDescription || null,
      isReminderTarget: data.isReminderTarget ?? false,
      showInMobileWO: data.showInMobileWO ?? false,
      // tenantId resolved by repository from request context
      updatedAt: new Date(),
    };
  }

  private buildUpdateInput(
    data: UpdateDepartmentData,
  ): UpdateDepartmentRepositoryInput {
    return {
      name: data.name,
      description: data.description,
      jobDescription: data.jobDescription,
      isReminderTarget: data.isReminderTarget,
      showInMobileWO: data.showInMobileWO,
    };
  }

  private async findDuplicateName(
    name: string | undefined,
    existing: DepartmentEntity,
  ) {
    if (!name || name === existing.name) {
      return null;
    }

    return this.departmentRepo.findByName(name);
  }

  private getDeletionError(
    department: DepartmentEntity,
  ): ServiceResult<void> | null {
    if (department.counts.users > 0) {
      return {
        success: false,
        error: `Tidak dapat menghapus departemen. Terdapat ${department.counts.users} pengguna yang terhubung.`,
        code: "HAS_USERS",
      };
    }

    if (department.counts.workOrders > 0) {
      return {
        success: false,
        error: `Tidak dapat menghapus departemen. Terdapat ${department.counts.workOrders} work order yang terhubung.`,
        code: "HAS_WORKORDERS",
      };
    }

    return null;
  }

  private logActivity(
    action: string,
    subject: string,
    userId: string,
    details: Record<string, unknown>,
  ): void {
    logActivitySafe({ action, subject, userId, details });
  }
}

let departmentServiceInstance: DepartmentService | null = null;

/** Get singleton department service instance. */
export function getDepartmentService(): DepartmentService {
  if (!departmentServiceInstance) {
    departmentServiceInstance = new DepartmentService();
  }

  return departmentServiceInstance;
}
