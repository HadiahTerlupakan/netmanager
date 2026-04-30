import type { Prisma, WorkOrderPriority, WorkOrderType } from "@prisma/client";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface TemplateListQuery extends PaginationQuery {
  search?: string;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  departmentId?: string;
  isActive?: boolean;
  sortBy: "name" | "type" | "priority" | "createdAt" | "updatedAt";
  sortOrder: Prisma.SortOrder;
}

export interface EscalationListQuery extends PaginationQuery {
  search?: string;
  slaId?: string;
  workOrderType?: WorkOrderType;
  priority?: WorkOrderPriority;
  departmentId?: string;
  escalationLevel?: number;
  isActive?: boolean;
  sortBy:
    | "name"
    | "slaId"
    | "workOrderType"
    | "priority"
    | "escalationLevel"
    | "createdAt"
    | "updatedAt";
  sortOrder: Prisma.SortOrder;
}

export interface SlaListQuery extends PaginationQuery {
  search?: string;
  workOrderType?: WorkOrderType;
  priority?: WorkOrderPriority;
  departmentId?: string;
  isActive?: boolean;
  sortBy:
    | "name"
    | "workOrderType"
    | "priority"
    | "responseTime"
    | "resolutionTime"
    | "createdAt"
    | "updatedAt";
  sortOrder: Prisma.SortOrder;
}

export function buildPagination(options: PaginationQuery) {
  const page = options.page ?? DEFAULT_PAGE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  return { skip: (page - 1) * limit, take: limit };
}

export function buildTemplateWhere(
  query: TemplateListQuery,
): Prisma.WorkOrderTemplatesWhereInput {
  const where: Prisma.WorkOrderTemplatesWhereInput = {};
  assignSearch(where, query.search);
  assignIfValue(where, "type", query.type);
  assignIfValue(where, "priority", query.priority);
  assignIfValue(where, "departmentId", query.departmentId);
  assignIfValue(where, "isActive", query.isActive);
  return where;
}

export function buildEscalationWhere(
  query: EscalationListQuery,
): Prisma.WorkOrderEscalationsWhereInput {
  const where: Prisma.WorkOrderEscalationsWhereInput = {};
  assignSearch(where, query.search);
  assignIfValue(where, "slaId", query.slaId);
  assignIfValue(where, "workOrderType", query.workOrderType);
  assignIfValue(where, "priority", query.priority);
  assignIfValue(where, "departmentId", query.departmentId);
  assignIfValue(where, "escalationLevel", query.escalationLevel);
  assignIfValue(where, "isActive", query.isActive);
  return where;
}

export function buildSlaWhere(query: SlaListQuery): Prisma.SlaWhereInput {
  const where: Prisma.SlaWhereInput = {};
  assignSearch(where, query.search);
  assignIfValue(where, "workOrderType", query.workOrderType);
  assignIfValue(where, "priority", query.priority);
  assignIfValue(where, "departmentId", query.departmentId);
  assignIfValue(where, "isActive", query.isActive);
  return where;
}

export function removeUndefinedFields<T extends Record<string, unknown>>(
  input: T,
): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export function buildDepartmentUpdate(departmentId?: string) {
  if (departmentId === undefined) return undefined;
  if (!departmentId) return { disconnect: true };
  return { connect: { id: departmentId } };
}

export function buildSlaUpdate(slaId?: string) {
  if (slaId === undefined) return undefined;
  if (!slaId) return { disconnect: true };
  return { connect: { id: slaId } };
}

export function buildEscalationCreateData(input: {
  payload: Record<string, unknown>;
  userId: string;
  id: string;
  updatedAt: Date;
}) {
  const { departmentId, slaId, ...rest } = input.payload as {
    departmentId?: string;
    slaId?: string;
  };

  return {
    ...createEscalationBase(rest, input),
    ...createDepartmentConnect(departmentId),
    ...createSlaConnect(slaId),
    user: { connect: { id: input.userId } },
  } satisfies Prisma.WorkOrderEscalationsCreateInput;
}

function createEscalationBase(
  rest: Record<string, unknown>,
  input: { id: string; updatedAt: Date },
) {
  const createInput = removeUndefinedFields(rest);
  return {
    ...(createInput as Prisma.WorkOrderEscalationsCreateInput),
    id: input.id,
    updatedAt: input.updatedAt,
  };
}

function createDepartmentConnect(departmentId?: string) {
  return departmentId ? { departments: { connect: { id: departmentId } } } : {};
}

function createSlaConnect(slaId?: string) {
  return slaId ? { sla: { connect: { id: slaId } } } : {};
}

export function buildEscalationUpdateData(input: Record<string, unknown>) {
  const { departmentId, slaId, ...rest } = input as {
    departmentId?: string;
    slaId?: string;
  };
  const updateInput = removeUndefinedFields(rest as Record<string, unknown>);

  return {
    ...(updateInput as Prisma.WorkOrderEscalationsUpdateInput),
    updatedAt: new Date(),
    ...(departmentId !== undefined
      ? { departments: buildDepartmentUpdate(departmentId) }
      : {}),
    ...(slaId !== undefined ? { sla: buildSlaUpdate(slaId) } : {}),
  } satisfies Prisma.WorkOrderEscalationsUpdateInput;
}

export function buildSlaCreateData(input: {
  payload: Record<string, unknown>;
  userId: string;
}) {
  const { departmentId, ...rest } = input.payload as { departmentId?: string };
  const createInput = removeUndefinedFields(rest as Record<string, unknown>);

  return {
    ...(createInput as Prisma.SlaCreateInput),
    user: { connect: { id: input.userId } },
    ...(departmentId ? { departments: { connect: { id: departmentId } } } : {}),
  } satisfies Prisma.SlaCreateInput;
}

export function buildSlaUpdateData(input: Record<string, unknown>) {
  const { departmentId, ...rest } = input as { departmentId?: string };
  const updateInput = removeUndefinedFields(rest as Record<string, unknown>);

  return {
    ...(updateInput as Prisma.SlaUpdateInput),
    updatedAt: new Date(),
    ...(departmentId !== undefined
      ? { departments: buildDepartmentUpdate(departmentId) }
      : {}),
  } satisfies Prisma.SlaUpdateInput;
}

function assignSearch(
  where: { OR?: Prisma.Enumerable<Prisma.StringFilter | object> },
  search?: string,
) {
  if (!search) return;

  where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { description: { contains: search, mode: "insensitive" } },
  ];
}

function assignIfValue<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
) {
  if (value === undefined || value === "") return;

  target[key] = value;
}
