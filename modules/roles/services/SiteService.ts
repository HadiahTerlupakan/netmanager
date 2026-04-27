import { logActivitySafe } from "@/lib/logger";
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

/**
 * Service for Site business logic.
 */
export class SiteService {
  private readonly repository: ISiteRepository;

  constructor(repository: ISiteRepository = createSiteRepository()) {
    this.repository = repository;
  }

  /** Get all sites as list DTOs. */
  async getSites(options?: SiteFilterOptions): Promise<SiteListItemDTO[]> {
    const sites = await this.repository.findAll(options);
    return SiteMapper.toListItemDTOs(sites);
  }

  /** Get site detail DTO by ID. */
  async getSiteById(id: string): Promise<SiteDetailDTO> {
    const site = await this.repository.findById(id);
    if (!site) {
      throw new Error("Site tidak ditemukan");
    }

    return SiteMapper.toDetailDTO(site);
  }

  /** Create new site and return detail DTO. */
  async createSite(
    data: SiteCreateInput,
    userId: string,
  ): Promise<SiteDetailDTO> {
    this.validateRequiredFields(data);
    await this.ensureUniqueCode(data.code);
    const site = await this.repository.create(this.buildCreateInput(data));
    this.logCreateActivity(site, userId, data.gudangIds);
    return SiteMapper.toDetailDTO(site);
  }

  /** Update site and return detail DTO. */
  async updateSite(
    id: string,
    data: SiteUpdateInput,
    userId: string,
  ): Promise<SiteDetailDTO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Site tidak ditemukan");
    }

    await this.ensureUniqueCodeForUpdate(data.code, existing);
    const site = await this.repository.update(id, this.buildUpdateInput(data));
    this.logUpdateActivity(site.id, userId, data);
    return SiteMapper.toDetailDTO(site);
  }

  /** Delete site using soft or hard delete rules. */
  async deleteSite(id: string, userId: string) {
    const site = await this.repository.findWithCounts(id);
    if (!site) {
      throw new Error("Site tidak ditemukan");
    }

    if (this.hasAssociations(site)) {
      await this.repository.deactivate(id);
      this.logDeactivateActivity(site, userId);
      return {
        softDeleted: true,
        message: "Site dinonaktifkan (memiliki pengguna/work order terkait)",
      };
    }

    await this.deleteWithoutAssociations(id);
    this.logDeleteActivity(site, userId);
    return { softDeleted: false, message: "Site berhasil dihapus" };
  }

  private validateRequiredFields(data: SiteCreateInput) {
    if (!data.code || !data.name) {
      throw new Error("Kode dan nama wajib diisi");
    }
  }

  private async ensureUniqueCode(code: string) {
    const existing = await this.repository.findByCode(code);
    if (existing) {
      throw new Error("Kode site sudah digunakan");
    }
  }

  private async ensureUniqueCodeForUpdate(
    code: string | undefined,
    existing: SiteEntity,
  ) {
    if (!code || code.toUpperCase() === existing.code) {
      return;
    }

    const duplicate = await this.repository.findByCode(code);
    if (duplicate) {
      throw new Error("Kode site sudah digunakan");
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

  private async deleteWithoutAssociations(id: string) {
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new Error("Site tidak ditemukan");
      }

      throw error;
    }
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
