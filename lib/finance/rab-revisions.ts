import { RabExpenseType, RabItemCategory, RabRevisionStatus } from "@prisma/client";

export interface RevisionSnapshotSourceItem {
  id?: string | null;
  rabItemId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: bigint;
  totalPrice?: bigint;
  category?: RabItemCategory | null;
  expenseType?: RabExpenseType | null;
  expenseCategoryId?: string | null;
  wbsId?: string | null;
  sortOrder?: number | null;
}

export interface RevisionSnapshotItemCreateInput {
  rabItemId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: bigint;
  totalPrice: bigint;
  category: RabItemCategory;
  expenseType: RabExpenseType;
  expenseCategoryId?: string | null;
  wbsId?: string | null;
  sortOrder: number;
}

interface RevisionSerializableItem {
  id: string;
  rabRevisionId: string;
  rabItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: bigint;
  totalPrice: bigint;
  category: RabItemCategory;
  expenseType: RabExpenseType;
  expenseCategoryId: string | null;
  wbsId: string | null;
  sortOrder: number;
}

interface RevisionSerializableApproval {
  id: string;
  rabRevisionId?: string;
  userId: string;
  status: string;
  notes?: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: { name?: string | null } | null;
  } | null;
}

interface RevisionSerializableRecord {
  id: string;
  rabProjectId: string;
  revisionNumber: number;
  status: RabRevisionStatus | string;
  reason?: string | null;
  notes?: string | null;
  createdById: string;
  submittedById?: string | null;
  submittedAt?: Date | null;
  approvedById?: string | null;
  approvedAt?: Date | null;
  rejectedById?: string | null;
  rejectedAt?: Date | null;
  totalCapex: bigint;
  totalOpex: bigint;
  createdAt: Date;
  updatedAt: Date;
  items?: RevisionSerializableItem[];
  approvals?: RevisionSerializableApproval[];
}

export interface RevisionTotals {
  totalCapex: bigint;
  totalOpex: bigint;
}

export const DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD = 1;

export function normalizeRevisionSnapshotItems(
  items: RevisionSnapshotSourceItem[],
): RevisionSnapshotItemCreateInput[] {
  return items.map((item, index) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = BigInt(item.unitPrice ?? 0n);
    const totalPrice = item.totalPrice ?? BigInt(quantity) * unitPrice;

    return {
      rabItemId: item.rabItemId ?? item.id ?? null,
      name: item.name,
      description: item.description ?? null,
      quantity,
      unitPrice,
      totalPrice,
      category: item.category ?? RabItemCategory.HARDWARE,
      expenseType: item.expenseType ?? RabExpenseType.CAPEX,
      expenseCategoryId: item.expenseCategoryId ?? null,
      wbsId: item.wbsId ?? null,
      sortOrder: item.sortOrder ?? index,
    };
  });
}

export function calculateRevisionTotals(
  items: RevisionSnapshotItemCreateInput[],
  projectedOpex?: bigint | null,
): RevisionTotals {
  const totalCapex = items.reduce((sum, item) => {
    if (item.expenseType === RabExpenseType.OPEX) {
      return sum;
    }

    return sum + item.totalPrice;
  }, 0n);

  const itemLevelOpex = items.reduce((sum, item) => {
    if (item.expenseType !== RabExpenseType.OPEX) {
      return sum;
    }

    return sum + item.totalPrice;
  }, 0n);

  return {
    totalCapex,
    totalOpex: projectedOpex ?? itemLevelOpex,
  };
}

export function serializeRabRevisionItem(item: RevisionSerializableItem) {
  return {
    ...item,
    unitPrice: item.unitPrice.toString(),
    totalPrice: item.totalPrice.toString(),
  };
}

export function serializeRabRevisionApproval(approval: RevisionSerializableApproval) {
  return {
    ...approval,
    user: approval.user ?? null,
  };
}

export function serializeRabRevision(revision: RevisionSerializableRecord) {
  return {
    ...revision,
    totalCapex: revision.totalCapex.toString(),
    totalOpex: revision.totalOpex.toString(),
    items: (revision.items ?? []).map(serializeRabRevisionItem),
    approvals: (revision.approvals ?? []).map(serializeRabRevisionApproval),
  };
}

export function getRevisionApprovalStatus(
  currentApprovalsCount: number,
  currentStatus: RabRevisionStatus,
) {
  if (currentApprovalsCount >= DEFAULT_RAB_REVISION_APPROVAL_THRESHOLD) {
    return RabRevisionStatus.APPROVED;
  }

  if (currentStatus === RabRevisionStatus.DRAFT) {
    return RabRevisionStatus.PENDING_APPROVAL;
  }

  return currentStatus;
}
