/**
 * SiteMapper
 *
 * Transforms Prisma entities to domain entities and domain entities to DTOs.
 */

import type { Sites } from "@prisma/client";
import type {
  SiteDetailDTO,
  SiteListItemDTO,
  SiteOptionDTO,
} from "../dto/SiteDTO";
import type { SiteEntity } from "../domain/entities/SiteEntity";

const DEFAULT_ATTENDANCE_RADIUS = 100;

export type PrismaSiteWithRelations = Sites & {
  _count?: {
    user?: number;
    work_orders?: number;
    pelanggan?: number;
  };
  gudang?: {
    id: string;
    nama: string;
    kode?: string | null;
  }[];
  gudangs?: {
    id: string;
    name: string;
  }[];
  user?: {
    id: string;
    name: string | null;
    email: string;
    departments?: {
      name: string;
    } | null;
  }[];
};

export class SiteMapper {
  /** Map Prisma site to domain entity. */
  static toDomain(entity: PrismaSiteWithRelations): SiteEntity {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      address: entity.address,
      isActive: entity.isActive,
      location: {
        latitude: entity.latitude,
        longitude: entity.longitude,
        attendanceRadius: entity.attendanceRadius ?? DEFAULT_ATTENDANCE_RADIUS,
      },
      gudangs: this.mapGudangs(entity),
      users: (entity.user ?? []).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        departmentName: user.departments?.name ?? null,
      })),
      counts: {
        users: entity._count?.user ?? 0,
        workOrders: entity._count?.work_orders ?? 0,
        pelanggan: entity._count?.pelanggan ?? 0,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /** Map many Prisma sites to domain entities. */
  static toDomains(entities: PrismaSiteWithRelations[]): SiteEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /** Map domain entity to list DTO. */
  static toListItemDTO(entity: SiteEntity): SiteListItemDTO {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      address: entity.address,
      isActive: entity.isActive,
      userCount: entity.counts.users,
      workOrderCount: entity.counts.workOrders,
    };
  }

  /** Map many domain entities to list DTOs. */
  static toListItemDTOs(entities: SiteEntity[]): SiteListItemDTO[] {
    return entities.map((entity) => this.toListItemDTO(entity));
  }

  /** Map domain entity to detail DTO. */
  static toDetailDTO(entity: SiteEntity): SiteDetailDTO {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      address: entity.address,
      isActive: entity.isActive,
      location: {
        latitude: entity.location.latitude,
        longitude: entity.location.longitude,
        attendanceRadius: entity.location.attendanceRadius,
      },
      stats: {
        userCount: entity.counts.users,
        workOrderCount: entity.counts.workOrders,
        pelangganCount: entity.counts.pelanggan,
      },
      users: entity.users,
      gudangs: entity.gudangs,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain entity to option DTO. */
  static toOptionDTO(entity: SiteEntity): SiteOptionDTO {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
    };
  }

  /** Map many domain entities to option DTOs. */
  static toOptionDTOs(entities: SiteEntity[]): SiteOptionDTO[] {
    return entities.map((entity) => this.toOptionDTO(entity));
  }

  private static mapGudangs(entity: PrismaSiteWithRelations) {
    if (entity.gudangs) {
      return entity.gudangs.map((gudang) => ({
        id: gudang.id,
        name: gudang.name,
      }));
    }

    return (entity.gudang ?? []).map((gudang) => ({
      id: gudang.id,
      name: gudang.nama,
    }));
  }
}
