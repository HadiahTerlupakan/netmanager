import { logger, logActivitySafe } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type { SiteDetailDTO, SiteListItemDTO } from "../dto/SiteDTO";
import type { SiteEntity } from "../domain/entities/SiteEntity";
import type {
  ISiteRepository,
  SiteCreateRepositoryInput,
  SiteFilterOptions,
  SiteUpdateRepositoryInput,
} from "../domain/ports/ISiteRepository";
import { createSiteRepository } from "../factories/RepositoryFactory";
import { SiteMapper } from "../mappers/SiteMapper";
import type { ServiceResult } from "./department-service.types";

const DEFAULT_ATTENDANCE_RADIUS = 100;

interface SiteCreateInput {
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  attendanceRadius?: string | number;
  gudangIds?: string[];
}

interface SiteUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  attendanceRadius?: string | number;
  isActive?: boolean;
  gudangIds?: string[];
}

interface SiteDeleteResult {
  softDeleted: boolean;
  message: string;
}

/**
 * Service for Site business logic.
 */
export class SiteService {
  private readonly repository: ISiteRepository;

  constructor(repository: ISiteRepository = createSiteRepository()) {
    this.repository = repository;
  }

  /** Get all sites as list DTOs. */
  async getSites(
    options?: SiteFilterOptions,
  ): Promise<ServiceResult<SiteListItemDTO[]>> {
    try {
      const sites = await this.repository.findAll(options);
      return { success: true, data: SiteMapper.toListItemDTOs(sites) };
    } catch (error) {
      logger.error(
        "SiteService.getSites failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil daftar site",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Get site detail DTO by ID. */
  async getSiteById(id: string): Promise<ServiceResult<SiteDetailDTO>> {
    try {
      const site = await this.repository.findById(id);
      if (!site) {
        return {
          success: false,
          error: "Site tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return { success: true, data: SiteMapper.toDetailDTO(site) };
    } catch (error) {
      logger.error(
        "SiteService.getSiteById failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil data site",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Lightweight site name lookup, returns null when site missing. */
  async getSiteNameById(id: string | null): Promise<{ name: string } | null> {
    if (!id) return null;
    return this.repository.findNameById(id);
  }

  /** Create new site and return detail DTO. */
  async createSite(
    data: SiteCreateInput,
    userId: string,
  ): Promise<ServiceResult<SiteDetailDTO>> {
    try {
      if (!data.code || !data.name) {
        return {
          success: false,
          error: "Kode dan nama wajib diisi",
          code: "VALIDATION_ERROR",
        };
      }

      const existingCode = await this.repository.findByCode(data.code);
      if (existingCode) {
        return {
          success: false,
          error: "Kode site sudah digunakan",
          code: "DUPLICATE_CODE",
        };
      }

      const site = await this.repository.create(this.buildCreateInput(data));
      this.logCreateActivity(site, userId, data.gudangIds);
      return { success: true, data: SiteMapper.toDetailDTO(site) };
    } catch (error) {
      logger.error(
        "SiteService.createSite failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal membuat site",
        code: "CREATE_ERROR",
      };
    }
  }

  /** Update site and return detail DTO. */
  async updateSite(
    id: string,
    data: SiteUpdateInput,
    userId: string,
  ): Promise<ServiceResult<SiteDetailDTO>> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Site tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (data.code && data.code.toUpperCase() !== existing.code) {
        const duplicate = await this.repository.findByCode(data.code);
        if (duplicate) {
          return {
            success: false,
            error: "Kode site sudah digunakan",
            code: "DUPLICATE_CODE",
          };
        }
      }

      const site = await this.repository.update(
        id,
        this.buildUpdateInput(data),
      );
      this.logUpdateActivity(site.id, userId, data);
      return { success: true, data: SiteMapper.toDetailDTO(site) };
    } catch (error) {
      logger.error(
        "SiteService.updateSite failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal memperbarui site",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Delete site using soft or hard delete rules. */
  async deleteSite(
    id: string,
    userId: string,
  ): Promise<ServiceResult<SiteDeleteResult>> {
    try {
      const site = await this.repository.findWithCounts(id);
      if (!site) {
        return {
          success: false,
          error: "Site tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (this.hasAssociations(site)) {
        await this.repository.deactivate(id);
        this.logDeactivateActivity(site, userId);
        return {
          success: true,
          data: {
            softDeleted: true,
            message:
              "Site dinonaktifkan (memiliki pengguna/work order terkait)",
          },
        };
      }

      await this.repository.delete(id);
      this.logDeleteActivity(site, userId);
      return {
        success: true,
        data: { softDeleted: false, message: "Site berhasil dihapus" },
      };
    } catch (error) {
      logger.error(
        "SiteService.deleteSite failed",
        error instanceof Error ? error : undefined,
      );
      if (isPrismaRecordNotFoundError(error)) {
        return {
          success: false,
          error: "Site tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return {
        success: false,
        error: "Gagal menghapus site",
        code: "DELETE_ERROR",
      };
    }
  }

  private buildCreateInput(data: SiteCreateInput): SiteCreateRepositoryInput {
    return {
      code: data.code,
      name: data.name,
      description: data.description,
      address: data.address,
      latitude: this.parseNullableNumber(data.latitude),
      longitude: this.parseNullableNumber(data.longitude),
      attendanceRadius: this.parseAttendanceRadius(data.attendanceRadius),
      gudangIds: data.gudangIds,
    };
  }

  private buildUpdateInput(data: SiteUpdateInput): SiteUpdateRepositoryInput {
    return {
      code: data.code,
      name: data.name,
      description: data.description,
      address: data.address,
      latitude: this.parseOptionalNullableNumber(data.latitude),
      longitude: this.parseOptionalNullableNumber(data.longitude),
      attendanceRadius: this.parseOptionalAttendanceRadius(
        data.attendanceRadius,
      ),
      isActive: data.isActive,
      gudangIds: data.gudangIds,
    };
  }

  private parseNullableNumber(value: string | number | null | undefined) {
    if (!value) {
      return null;
    }

    return Number.parseFloat(String(value));
  }

  private parseOptionalNullableNumber(
    value: string | number | null | undefined,
  ) {
    if (value === undefined) {
      return undefined;
    }

    return value ? Number.parseFloat(String(value)) : null;
  }

  private parseAttendanceRadius(value: string | number | undefined) {
    if (!value) {
      return DEFAULT_ATTENDANCE_RADIUS;
    }

    return Number.parseInt(String(value));
  }

  private parseOptionalAttendanceRadius(value: string | number | undefined) {
    if (value === undefined) {
      return undefined;
    }

    return Number.parseInt(String(value));
  }

  private hasAssociations(site: SiteEntity) {
    return site.counts.users > 0 || site.counts.workOrders > 0;
  }

  private logCreateActivity(
    site: SiteEntity,
    userId: string,
    gudangIds?: string[],
  ) {
    logActivitySafe({
      action: "CREATE",
      subject: "Site",
      userId,
      details: {
        id: site.id,
        name: site.name,
        code: site.code,
        assignedGudangs: gudangIds?.length ?? 0,
      },
    });
  }

  private logUpdateActivity(
    siteId: string,
    userId: string,
    data: SiteUpdateInput,
  ) {
    logActivitySafe({
      action: "UPDATE",
      subject: "Site",
      userId,
      details: {
        id: siteId,
        updates: {
          ...data,
          gudangIdsCount: Array.isArray(data.gudangIds)
            ? data.gudangIds.length
            : "unchanged",
        },
      },
    });
  }

  private logDeactivateActivity(site: SiteEntity, userId: string) {
    logActivitySafe({
      action: "UPDATE",
      subject: "Site",
      userId,
      details: { id: site.id, name: site.name, status: "DEACTIVATED" },
    });
  }

  private logDeleteActivity(site: SiteEntity, userId: string) {
    logActivitySafe({
      action: "DELETE",
      subject: "Site",
      userId,
      details: { id: site.id, name: site.name },
    });
  }
}
