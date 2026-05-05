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
import {
  assertDraftRevisionCanBeSubmitted,
  assertDraftRevisionStatus,
  assertRevisionBelongsToProject,
  createRabRevisionDetailQuery,
  createRabRevisionDraftQuery,
  createRabRevisionListQuery,
  getRabRevisionDetailInclude,
} from "./rab-revision-route.helpers";

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
    const revisions = await prisma.rabRevision.findMany(
      createRabRevisionListQuery(projectId),
    );
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

    const existingDraft = await prisma.rabRevision.findFirst(
      createRabRevisionDraftQuery(project.id),
    );
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
        items: { create: baseItems },
      },
      include: getRabRevisionDetailInclude(),
    });

    return serializeRabRevision(revision);
  }

  /** Get one revision detail scoped to its project. */
  async getRevision(projectId: string, revisionId: string) {
    const revision = await prisma.rabRevision.findUnique(
      createRabRevisionDetailQuery(revisionId),
    );
    assertRevisionBelongsToProject(revision, projectId);
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

    assertRevisionBelongsToProject(existingRevision, input.projectId);
    assertDraftRevisionStatus(existingRevision.status);

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
          ? { deleteMany: {}, create: snapshotItems }
          : undefined,
      },
      include: getRabRevisionDetailInclude(),
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

    assertRevisionBelongsToProject(revision, input.projectId);
    assertDraftRevisionCanBeSubmitted({
      status: revision.status,
      itemsLength: revision.items.length,
    });

    const submittedRevision = await prisma.rabRevision.update({
      where: { id: revision.id },
      data: {
        status: RabRevisionStatus.PENDING_APPROVAL,
        reason: input.reason,
        submittedById: input.userId,
        submittedAt: new Date(),
      },
      include: getRabRevisionDetailInclude(),
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
