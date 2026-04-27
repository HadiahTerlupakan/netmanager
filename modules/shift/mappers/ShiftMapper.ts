import type { Shift } from "@prisma/client";
import type {
  ShiftDetailDTO,
  ShiftListItemDTO,
  ShiftOptionDTO,
} from "../dto/ShiftDTO";
import type {
  ShiftEntity,
  ShiftUserEntity,
} from "../domain/entities/ShiftEntity";

type PrismaShiftUser = {
  id: string;
  name: string | null;
  email: string;
};

type PrismaShiftRecord = Shift & {
  users?: PrismaShiftUser[];
  _count?: {
    users?: number;
  };
};

export class ShiftMapper {
  /** Memetakan record Prisma menjadi domain entity. */
  static toDomain(record: PrismaShiftRecord): ShiftEntity {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      startTime: record.startTime,
      endTime: record.endTime,
      description: record.description,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tenantId: record.tenantId,
      users: this.toDomainUsers(record.users),
      userCount: this.resolveUserCount(record),
    };
  }

  /** Memetakan banyak record Prisma menjadi domain entity. */
  static toDomainList(records: PrismaShiftRecord[]): ShiftEntity[] {
    return records.map((record) => this.toDomain(record));
  }

  /** Memetakan domain entity menjadi DTO list. */
  static toListDTO(entity: ShiftEntity): ShiftListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      startTime: entity.startTime,
      endTime: entity.endTime,
      isActive: entity.isActive,
      userCount: entity.userCount,
    };
  }

  /** Memetakan banyak domain entity menjadi DTO list. */
  static toListDTOs(entities: ShiftEntity[]): ShiftListItemDTO[] {
    return entities.map((entity) => this.toListDTO(entity));
  }

  /** Memetakan domain entity menjadi DTO detail. */
  static toDetailDTO(entity: ShiftEntity): ShiftDetailDTO {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      startTime: entity.startTime,
      endTime: entity.endTime,
      description: entity.description,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      users: entity.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
    };
  }

  /** Memetakan domain entity menjadi DTO option. */
  static toOptionDTO(entity: ShiftEntity): ShiftOptionDTO {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      time: `${entity.startTime} - ${entity.endTime}`,
    };
  }

  /** Memetakan banyak domain entity menjadi DTO option. */
  static toOptionDTOs(entities: ShiftEntity[]): ShiftOptionDTO[] {
    return entities.map((entity) => this.toOptionDTO(entity));
  }

  private static toDomainUsers(users?: PrismaShiftUser[]): ShiftUserEntity[] {
    if (!users) {
      return [];
    }

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));
  }

  private static resolveUserCount(record: PrismaShiftRecord): number {
    if (typeof record._count?.users === "number") {
      return record._count.users;
    }

    return record.users?.length ?? 0;
  }
}
