import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  buildDepartmentUpdate,
  buildEscalationCreateData,
  buildEscalationUpdateData,
  buildEscalationWhere,
  buildPagination,
  buildSlaCreateData,
  buildSlaUpdateData,
  buildSlaWhere,
  buildTemplateWhere,
  removeUndefinedFields,
  type EscalationListQuery,
  type SlaListQuery,
  type TemplateListQuery,
} from "./admin-work-order-config.helpers";
export type {
  EscalationListQuery,
  SlaListQuery,
  TemplateListQuery,
} from "./admin-work-order-config.helpers";
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

/** Repository konfigurasi admin work order berbasis Prisma. */
export class AdminWorkOrderConfigRepository {
  /** Ambil daftar template work order dengan pagination. */
  async findTemplates(query: TemplateListQuery) {
    const where = buildTemplateWhere(query);
    const pagination = buildPagination(query);

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
    const createInput = removeUndefinedFields(rest as Record<string, unknown>);
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
    const updateInput = removeUndefinedFields(rest as Record<string, unknown>);
    const data = {
      ...(updateInput as Prisma.WorkOrderTemplatesUpdateInput),
      updatedAt: new Date(),
      ...(departmentId !== undefined
        ? { departments: buildDepartmentUpdate(departmentId) }
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
    const where = buildEscalationWhere(query);
    const pagination = buildPagination(query);

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
    const data = buildEscalationCreateData({
      payload: input,
      userId,
      id: randomUUID(),
      updatedAt: new Date(),
    });

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
    return prisma.workOrderEscalations.update({
      where: { id },
      data: buildEscalationUpdateData(input),
      include: escalationInclude,
    });
  }

  /** Hapus escalation rule. */
  async deleteEscalation(id: string) {
    await prisma.workOrderEscalations.delete({ where: { id } });
  }

  /** Ambil daftar SLA dengan pagination. */
  async findSlas(query: SlaListQuery) {
    const where = buildSlaWhere(query);
    const pagination = buildPagination(query);

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
    return SLA_MODEL.create({
      data: buildSlaCreateData({ payload: input, userId }),
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
    return SLA_MODEL.update({
      where: { id },
      data: buildSlaUpdateData(input),
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
}
