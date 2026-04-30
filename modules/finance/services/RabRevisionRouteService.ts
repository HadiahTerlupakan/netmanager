import { RabRevisionStatus } from "../types/invoice.enums";

import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/modules/database";

import {
  calculateRevisionTotals,
  normalizeRevisionSnapshotItems,
  serializeRabRevision,
  type RevisionSnapshotSourceItem,
} from "../utils/rab-revisions";
import { rejectRabRevision } from "./RabRevisionApprovalService";
import { createRouteServiceError } from "./RouteServiceError";

interface RevisionAccessUser {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}

export class RabRevisionRouteService {
  /** Memastikan user memiliki akses untuk melihat atau mengubah revisi RAB. */
  async assertRevisionAccess(user: RevisionAccessUser) {
    const hasAccess =
      isSuperAdmin(user) ||
      (await hasPermission("expense:update")) ||
      (await hasPermission("mixradius_expenses:update"));

    if (!hasAccess) {
      throw createRouteServiceError(
        "Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update",
        403,
      );
    }
  }

  /** Get all revisions for a RAB project. */
  async getRevisions(projectId: string) {
    const revisions = await prisma.rabRevision.findMany({
      where: { rabProjectId: projectId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { revisionNumber: "desc" },
    });

    return revisions.map(serializeRabRevision);
  }

  /** Create a draft revision or return existing draft. */
  async createRevision(projectId: string, userId: string, notes?: string) {
    const project = await prisma.rabProject.findUnique({
      where: { id: projectId },
      include: {
        items: true,
        revisions: {
          select: { revisionNumber: true },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        finalApprovedRevision: {
          include: { items: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    if (!project) {
      throw createRouteServiceError("Proyek RAB", 404);
    }

    const existingDraft = await prisma.rabRevision.findFirst({
      where: {
        rabProjectId: project.id,
        status: RabRevisionStatus.DRAFT,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (existingDraft) {
      return serializeRabRevision(existingDraft);
    }

    const baseItems = project.finalApprovedRevision
      ? normalizeRevisionSnapshotItems(project.finalApprovedRevision.items)
      : normalizeRevisionSnapshotItems(project.items);
    const totals = calculateRevisionTotals(
      baseItems,
      project.finalApprovedRevision?.totalOpex ?? project.projectedOpex,
    );
    const revision = await prisma.rabRevision.create({
      data: {
        rabProjectId: project.id,
        revisionNumber: (project.revisions[0]?.revisionNumber ?? 0) + 1,
        status: RabRevisionStatus.DRAFT,
        notes,
        createdById: userId,
        totalCapex: totals.totalCapex,
        totalOpex: totals.totalOpex,
        items: {
          create: baseItems,
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return serializeRabRevision(revision);
  }

  /** Get one revision detail scoped to its project. */
  async getRevision(projectId: string, revisionId: string) {
    const revision = await prisma.rabRevision.findUnique({
      where: { id: revisionId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!revision || revision.rabProjectId !== projectId) {
      throw createRouteServiceError("Revisi RAB", 404);
    }

    return serializeRabRevision(revision);
  }

  /** Update a draft revision and recalculate totals. */
  async updateRevision(input: {
    projectId: string;
    revisionId: string;
    notes?: string;
    projectedOpex?: bigint;
    items?: Array<{
      rabItemId?: string;
      name: string;
      description?: string | null;
      quantity: number;
      unitPrice: bigint;
      category: string;
      expenseType: string;
      expenseCategoryId?: string | null;
      wbsId?: string | null;
      sortOrder?: number;
    }>;
  }) {
    const existingRevision = await prisma.rabRevision.findUnique({
      where: { id: input.revisionId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (
      !existingRevision ||
      existingRevision.rabProjectId !== input.projectId
    ) {
      throw createRouteServiceError("Revisi RAB", 404);
    }

    if (existingRevision.status !== RabRevisionStatus.DRAFT) {
      throw createRouteServiceError(
        "Hanya revisi dengan status DRAFT yang dapat diubah",
        400,
      );
    }

    const snapshotItems = input.items
      ? normalizeRevisionSnapshotItems(
          input.items.map<RevisionSnapshotSourceItem>((item) => ({
            rabItemId: item.rabItemId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            category: item.category as RevisionSnapshotSourceItem["category"],
            expenseType:
              item.expenseType as RevisionSnapshotSourceItem["expenseType"],
            expenseCategoryId: item.expenseCategoryId,
            wbsId: item.wbsId,
            sortOrder: item.sortOrder,
            totalPrice: BigInt(item.quantity) * item.unitPrice,
          })),
        )
      : normalizeRevisionSnapshotItems(existingRevision.items);
    const totals = calculateRevisionTotals(
      snapshotItems,
      input.projectedOpex ?? existingRevision.totalOpex,
    );
    const revision = await prisma.rabRevision.update({
      where: { id: existingRevision.id },
      data: {
        notes: input.notes,
        totalCapex: totals.totalCapex,
        totalOpex: totals.totalOpex,
        items: input.items
          ? {
              deleteMany: {},
              create: snapshotItems,
            }
          : undefined,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return serializeRabRevision(revision);
  }

  /** Submit a draft revision into approval flow. */
  async submitRevision(input: {
    projectId: string;
    revisionId: string;
    reason: string;
    userId: string;
  }) {
    const revision = await prisma.rabRevision.findUnique({
      where: { id: input.revisionId },
      include: { items: true, approvals: true },
    });

    if (!revision || revision.rabProjectId !== input.projectId) {
      throw createRouteServiceError("Revisi RAB", 404);
    }

    if (revision.status !== RabRevisionStatus.DRAFT) {
      throw createRouteServiceError(
        "Hanya revisi dengan status DRAFT yang dapat diajukan",
        400,
      );
    }

    if (revision.items.length === 0) {
      throw createRouteServiceError(
        "Revisi harus memiliki minimal satu item",
        400,
      );
    }

    const submittedRevision = await prisma.rabRevision.update({
      where: { id: revision.id },
      data: {
        status: RabRevisionStatus.PENDING_APPROVAL,
        reason: input.reason,
        submittedById: input.userId,
        submittedAt: new Date(),
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return serializeRabRevision(submittedRevision);
  }

  /** Reject a pending revision as approver. */
  async rejectRevision(input: {
    projectId: string;
    revisionId: string;
    userId: string;
    notes?: string;
  }) {
    return rejectRabRevision({
      rabProjectId: input.projectId,
      revisionId: input.revisionId,
      userId: input.userId,
      notes: input.notes,
    });
  }
}
