/**
 * SystemLogMapper
 *
 * Transforms Prisma models to domain entities and domain entities to DTOs.
 */

import type { SystemLog } from "@prisma/client";
import type {
  ActivityTimelineDTO,
  SystemLogDetailDTO,
  SystemLogListItemDTO,
} from "../dto/SystemLogDTO";
import type {
  SystemLogActionStatEntity,
  SystemLogEntity,
  SystemLogSubjectStatEntity,
  SystemLogUserEntity,
} from "../domain/entities/SystemLogEntity";
import type { SystemLogType } from "../types/SystemLog";

type PrismaSystemLogWithUser = SystemLog & {
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type PrismaActionStat = {
  action: string;
  _count: { _all: number };
};

type PrismaSubjectStat = {
  subject: string;
  _count: { _all: number };
};

const DEFAULT_SYSTEM_USER_NAME = "System";
const DEFAULT_ACTION_COLOR = "gray";

export class SystemLogMapper {
  /** Map Prisma log model to domain entity. */
  static toDomain(model: PrismaSystemLogWithUser): SystemLogEntity {
    return {
      id: model.id,
      type: model.type as SystemLogType,
      action: model.action,
      subject: model.subject,
      details: this.parseDetails(model.details),
      createdAt: model.createdAt,
      user: this.mapUser(model.user),
      request: {
        ipAddress: model.ipAddress,
        userAgent: model.userAgent,
      },
    };
  }

  /** Map Prisma action stat row to domain entity. */
  static toActionStat(model: PrismaActionStat): SystemLogActionStatEntity {
    return { action: model.action, count: model._count._all };
  }

  /** Map Prisma subject stat row to domain entity. */
  static toSubjectStat(model: PrismaSubjectStat): SystemLogSubjectStatEntity {
    return { subject: model.subject, count: model._count._all };
  }

  /** Map domain entity to list item DTO. */
  static toListItem(entity: SystemLogEntity): SystemLogListItemDTO {
    return {
      id: entity.id,
      type: entity.type,
      action: entity.action,
      subject: entity.subject,
      createdAt: entity.createdAt.toISOString(),
      userName: entity.user?.name ?? null,
      userEmail: entity.user?.email ?? null,
    };
  }

  /** Map domain entities to list item DTOs. */
  static toListItems(entities: SystemLogEntity[]): SystemLogListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map domain entity to detail DTO. */
  static toDetail(entity: SystemLogEntity): SystemLogDetailDTO {
    return {
      id: entity.id,
      type: entity.type,
      action: entity.action,
      subject: entity.subject,
      details: entity.details,
      createdAt: entity.createdAt.toISOString(),
      user: entity.user,
      request: entity.request,
    };
  }

  /** Map domain entity to timeline DTO. */
  static toTimeline(entity: SystemLogEntity): ActivityTimelineDTO {
    return {
      id: entity.id,
      action: entity.action,
      subject: entity.subject,
      description: this.buildDescription(entity),
      createdAt: entity.createdAt.toISOString(),
      user: entity.user ? { name: entity.user.name } : null,
    };
  }

  /** Map domain entities to timeline DTOs. */
  static toTimelineList(entities: SystemLogEntity[]): ActivityTimelineDTO[] {
    return entities.map((entity) => this.toTimeline(entity));
  }

  /** Format action label for UI usage. */
  static formatAction(action: string): string {
    const actionLabels: Record<string, string> = {
      CREATE: "Buat",
      UPDATE: "Update",
      DELETE: "Hapus",
      LOGIN: "Login",
      LOGOUT: "Logout",
      ASSIGN: "Assign",
      APPROVE: "Approve",
      REJECT: "Reject",
      STATUS_CHANGE: "Status Change",
    };

    return actionLabels[action] ?? action;
  }

  /** Get action color name for UI usage. */
  static getActionColor(action: string): string {
    const colors: Record<string, string> = {
      CREATE: "green",
      UPDATE: "blue",
      DELETE: "red",
      LOGIN: "cyan",
      LOGOUT: "gray",
      ASSIGN: "purple",
      APPROVE: "green",
      REJECT: "red",
      STATUS_CHANGE: "orange",
    };

    return colors[action] ?? DEFAULT_ACTION_COLOR;
  }

  private static mapUser(
    user: PrismaSystemLogWithUser["user"],
  ): SystemLogUserEntity | null {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  private static parseDetails(
    details: unknown,
  ): Record<string, unknown> | null {
    if (!details) {
      return null;
    }

    if (typeof details === "string") {
      return this.parseStringDetails(details);
    }

    return details as Record<string, unknown>;
  }

  private static parseStringDetails(
    details: string,
  ): Record<string, unknown> | null {
    try {
      return JSON.parse(details) as Record<string, unknown>;
    } catch {
      return { raw: details };
    }
  }

  private static buildDescription(log: SystemLogEntity): string {
    const actionMap: Record<string, string> = {
      CREATE: "membuat",
      UPDATE: "mengupdate",
      DELETE: "menghapus",
      LOGIN: "login ke",
      LOGOUT: "logout dari",
      ASSIGN: "menetapkan",
      APPROVE: "menyetujui",
      REJECT: "menolak",
      STATUS_CHANGE: "mengubah status",
    };
    const action = actionMap[log.action] ?? log.action.toLowerCase();
    const subject = log.subject.replace(/_/g, " ").toLowerCase();
    const userName = log.user?.name ?? DEFAULT_SYSTEM_USER_NAME;

    return `${userName} ${action} ${subject}`;
  }
}
