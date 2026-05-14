/**
 * DepartmentMapper
 *
 * Transforms Prisma entities to domain entities and domain entities to DTOs.
 */

import type { Departments } from "@prisma/client";
import type {
  DepartmentDetailDTO,
  DepartmentListItemDTO,
  DepartmentOptionDTO,
} from "../dto/DepartmentDTO";
import type { DepartmentEntity } from "../domain/entities/DepartmentEntity";

export type PrismaDepartmentWithRelations = Departments & {
  _count?: {
    user?: number;
    work_orders?: number;
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
  }[];
};

export class DepartmentMapper {
  /** Map Prisma department to domain entity. */
  static toDomain(entity: PrismaDepartmentWithRelations): DepartmentEntity {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      jobDescription: entity.jobDescription,
      isReminderTarget: entity.isReminderTarget,
      showInMobileWO: entity.showInMobileWO,
      users: (entity.user ?? []).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
      counts: {
        users: entity._count?.user ?? 0,
        workOrders: entity._count?.work_orders ?? 0,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /** Map many Prisma departments to domain entities. */
  static toDomains(
    entities: PrismaDepartmentWithRelations[],
  ): DepartmentEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /** Map domain entity to list DTO. */
  static toListItemDTO(entity: DepartmentEntity): DepartmentListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      isReminderTarget: entity.isReminderTarget,
      showInMobileWO: entity.showInMobileWO,
      userCount: entity.counts.users,
      workOrderCount: entity.counts.workOrders,
    };
  }

  /** Map many domain entities to list DTOs. */
  static toListItemDTOs(entities: DepartmentEntity[]): DepartmentListItemDTO[] {
    return entities.map((entity) => this.toListItemDTO(entity));
  }

  /** Map domain entity to detail DTO. */
  static toDetailDTO(entity: DepartmentEntity): DepartmentDetailDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      jobDescription: entity.jobDescription,
      isReminderTarget: entity.isReminderTarget,
      showInMobileWO: entity.showInMobileWO,
      stats: {
        userCount: entity.counts.users,
        workOrderCount: entity.counts.workOrders,
      },
      users: entity.users,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain entity to option DTO. */
  static toOptionDTO(entity: DepartmentEntity): DepartmentOptionDTO {
    return {
      id: entity.id,
      name: entity.name,
    };
  }

  /** Map many domain entities to option DTOs. */
  static toOptionDTOs(entities: DepartmentEntity[]): DepartmentOptionDTO[] {
    return entities.map((entity) => this.toOptionDTO(entity));
  }
}
