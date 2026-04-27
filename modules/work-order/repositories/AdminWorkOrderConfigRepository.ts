import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma, WorkOrderPriority, WorkOrderType } from "@prisma/client";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const SLA_MODEL = prisma.sla;

const templateInclude = {
  departments: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.WorkOrderTemplatesInclude;

const escalationInclude = {
  sla: {
    select: {
      id: true,
      name: true,
      responseTime: true,
      resolutionTime: true,
    },
  },
  departments: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.WorkOrderEscalationsInclude;

const slaListInclude = {
  departments: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  workOrderEscalations: {
    select: { id: true, name: true, escalationLevel: true },
  },
} satisfies Prisma.SlaInclude;

const slaDetailInclude = {
  departments: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  workOrderEscalations: {
    select: {
      id: true,
      name: true,
      escalationLevel: true,
      triggerCondition: true,
    },
  },
  workOrders: {
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      status: true,
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SlaInclude;

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

interface PaginationOptions {
  page?: number;
  limit?: number;
}

/** Repository konfigurasi admin work order berbasis Prisma. */
export class AdminWorkOrderConfigRepository {
  /** Hapus field undefined dari payload Prisma. */
  private removeUndefinedFields<T extends Record<string, unknown>>(
    input: T,
  ): T {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as T;
  }
  /** Ambil daftar template work order dengan pagination. */
  async findTemplates(query: TemplateListQuery) {
    const where = this.buildTemplateWhere(query);
    const pagination = this.buildPagination(query);

    const [data, total] = await Promise.all([
      prisma.workOrderTemplates.findMany({
        where,
        include: templateInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.workOrderTemplates.count({ where }),
    ]);

    return { data, total };
  }

  /** Buat template work order baru. */
  async createTemplate(input: Record<string, unknown>, userId: string) {
    const { departmentId, ...rest } = input as { departmentId?: string };
    const createInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(createInput as Prisma.WorkOrderTemplatesCreateInput),
      id: randomUUID(),
      updatedAt: new Date(),
      ...(departmentId
        ? { departments: { connect: { id: departmentId } } }
        : {}),
      user: { connect: { id: userId } },
    } satisfies Prisma.WorkOrderTemplatesCreateInput;

    return prisma.workOrderTemplates.create({ data, include: templateInclude });
  }

  /** Ambil detail template work order. */
  async findTemplateById(id: string) {
    return prisma.workOrderTemplates.findUnique({
      where: { id },
      include: templateInclude,
    });
  }

  /** Perbarui template work order. */
  async updateTemplate(id: string, input: Record<string, unknown>) {
    const { departmentId, ...rest } = input as { departmentId?: string };
    const updateInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(updateInput as Prisma.WorkOrderTemplatesUpdateInput),
      updatedAt: new Date(),
      ...(departmentId !== undefined
        ? { departments: this.buildDepartmentUpdate(departmentId) }
        : {}),
    } satisfies Prisma.WorkOrderTemplatesUpdateInput;

    return prisma.workOrderTemplates.update({
      where: { id },
      data,
      include: templateInclude,
    });
  }

  /** Hitung jumlah work order yang memakai template. */
  async countWorkOrdersByTemplateId(id: string) {
    return prisma.workOrders.count({ where: { templateId: id } });
  }

  /** Hapus template work order. */
  async deleteTemplate(id: string) {
    await prisma.workOrderTemplates.delete({ where: { id } });
  }

  /** Ambil daftar escalation rule dengan pagination. */
  async findEscalations(query: EscalationListQuery) {
    const where = this.buildEscalationWhere(query);
    const pagination = this.buildPagination(query);

    const [data, total] = await Promise.all([
      prisma.workOrderEscalations.findMany({
        where,
        include: escalationInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.workOrderEscalations.count({ where }),
    ]);

    return { data, total };
  }

  /** Buat escalation rule baru. */
  async createEscalation(input: Record<string, unknown>, userId: string) {
    const { departmentId, slaId, ...rest } = input as {
      departmentId?: string;
      slaId?: string;
    };
    const createInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(createInput as Prisma.WorkOrderEscalationsCreateInput),
      id: randomUUID(),
      updatedAt: new Date(),
      ...(departmentId
        ? { departments: { connect: { id: departmentId } } }
        : {}),
      ...(slaId ? { sla: { connect: { id: slaId } } } : {}),
      user: { connect: { id: userId } },
    } satisfies Prisma.WorkOrderEscalationsCreateInput;

    return prisma.workOrderEscalations.create({
      data,
      include: escalationInclude,
    });
  }

  /** Ambil detail escalation rule. */
  async findEscalationById(id: string) {
    return prisma.workOrderEscalations.findUnique({
      where: { id },
      include: escalationInclude,
    });
  }

  /** Perbarui escalation rule. */
  async updateEscalation(id: string, input: Record<string, unknown>) {
    const { departmentId, slaId, ...rest } = input as {
      departmentId?: string;
      slaId?: string;
    };
    const updateInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(updateInput as Prisma.WorkOrderEscalationsUpdateInput),
      updatedAt: new Date(),
      ...(departmentId !== undefined
        ? { departments: this.buildDepartmentUpdate(departmentId) }
        : {}),
      ...(slaId !== undefined ? { sla: this.buildSlaUpdate(slaId) } : {}),
    } satisfies Prisma.WorkOrderEscalationsUpdateInput;

    return prisma.workOrderEscalations.update({
      where: { id },
      data,
      include: escalationInclude,
    });
  }

  /** Hapus escalation rule. */
  async deleteEscalation(id: string) {
    await prisma.workOrderEscalations.delete({ where: { id } });
  }

  /** Ambil daftar SLA dengan pagination. */
  async findSlas(query: SlaListQuery) {
    const where = this.buildSlaWhere(query);
    const pagination = this.buildPagination(query);

    const [data, total] = await Promise.all([
      SLA_MODEL.findMany({
        where,
        include: slaListInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
      }),
      SLA_MODEL.count({ where }),
    ]);

    return { data, total };
  }

  /** Buat aturan SLA baru. */
  async createSla(input: Record<string, unknown>, userId: string) {
    const { departmentId, ...rest } = input as { departmentId?: string };
    const createInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(createInput as Prisma.SlaCreateInput),
      user: { connect: { id: userId } },
      ...(departmentId
        ? { departments: { connect: { id: departmentId } } }
        : {}),
    } satisfies Prisma.SlaCreateInput;

    return SLA_MODEL.create({
      data,
      include: {
        departments: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  /** Ambil detail aturan SLA. */
  async findSlaById(id: string) {
    return SLA_MODEL.findUnique({
      where: { id },
      include: slaDetailInclude,
    });
  }

  /** Cek keberadaan aturan SLA. */
  async hasSla(id: string) {
    const sla = await SLA_MODEL.findUnique({
      where: { id },
      select: { id: true },
    });
    return Boolean(sla);
  }

  /** Perbarui aturan SLA. */
  async updateSla(id: string, input: Record<string, unknown>) {
    const { departmentId, ...rest } = input as { departmentId?: string };
    const updateInput = this.removeUndefinedFields(
      rest as Record<string, unknown>,
    );
    const data = {
      ...(updateInput as Prisma.SlaUpdateInput),
      updatedAt: new Date(),
      ...(departmentId !== undefined
        ? { departments: this.buildDepartmentUpdate(departmentId) }
        : {}),
    } satisfies Prisma.SlaUpdateInput;

    return SLA_MODEL.update({
      where: { id },
      data,
      include: {
        departments: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        workOrderEscalations: {
          select: { id: true, name: true, escalationLevel: true },
        },
      },
    });
  }

  /** Hitung jumlah work order yang memakai SLA. */
  async countWorkOrdersBySlaId(id: string) {
    return prisma.workOrders.count({ where: { slaId: id } });
  }

  /** Hapus aturan SLA. */
  async deleteSla(id: string) {
    await SLA_MODEL.delete({ where: { id } });
  }

  private buildPagination(options: PaginationOptions) {
    const page = options.page ?? DEFAULT_PAGE;
    const limit = options.limit ?? DEFAULT_LIMIT;
    return { skip: (page - 1) * limit, take: limit };
  }

  private buildTemplateWhere(
    query: TemplateListQuery,
  ): Prisma.WorkOrderTemplatesWhereInput {
    const where: Prisma.WorkOrderTemplatesWhereInput = {};
    this.assignSearch(where, query.search);
    this.assignIfValue(where, "type", query.type);
    this.assignIfValue(where, "priority", query.priority);
    this.assignIfValue(where, "departmentId", query.departmentId);
    this.assignIfValue(where, "isActive", query.isActive);
    return where;
  }

  private buildEscalationWhere(
    query: EscalationListQuery,
  ): Prisma.WorkOrderEscalationsWhereInput {
    const where: Prisma.WorkOrderEscalationsWhereInput = {};
    this.assignSearch(where, query.search);
    this.assignIfValue(where, "slaId", query.slaId);
    this.assignIfValue(where, "workOrderType", query.workOrderType);
    this.assignIfValue(where, "priority", query.priority);
    this.assignIfValue(where, "departmentId", query.departmentId);
    this.assignIfValue(where, "escalationLevel", query.escalationLevel);
    this.assignIfValue(where, "isActive", query.isActive);
    return where;
  }

  private buildSlaWhere(query: SlaListQuery): Prisma.SlaWhereInput {
    const where: Prisma.SlaWhereInput = {};
    this.assignSearch(where, query.search);
    this.assignIfValue(where, "workOrderType", query.workOrderType);
    this.assignIfValue(where, "priority", query.priority);
    this.assignIfValue(where, "departmentId", query.departmentId);
    this.assignIfValue(where, "isActive", query.isActive);
    return where;
  }

  private assignSearch(
    where: { OR?: Prisma.Enumerable<Prisma.StringFilter | object> },
    search?: string,
  ) {
    if (!search) {
      return;
    }

    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  private assignIfValue<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined,
  ) {
    if (value === undefined || value === "") {
      return;
    }

    target[key] = value;
  }

  private buildDepartmentUpdate(departmentId?: string) {
    if (departmentId === undefined) {
      return undefined;
    }

    if (!departmentId) {
      return { disconnect: true };
    }

    return { connect: { id: departmentId } };
  }

  private buildSlaUpdate(slaId?: string) {
    if (slaId === undefined) {
      return undefined;
    }

    if (!slaId) {
      return { disconnect: true };
    }

    return { connect: { id: slaId } };
  }
}
