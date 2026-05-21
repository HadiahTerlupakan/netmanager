import { prisma } from "@/lib/prisma";
import type {
  IEmployeePayrollProfileRepository,
  ProfileFilter,
  EmployeePayrollProfile,
  EmployeeComponent,
} from "@/modules/salary/core";

/**
 * Prisma implementation of IEmployeePayrollProfileRepository.
 * Handles employee payroll profile CRUD with component assignments and tenant isolation.
 */
export class PrismaEmployeePayrollProfileRepository implements IEmployeePayrollProfileRepository {
  async findByUserId(
    userId: string,
    tenantId: string,
  ): Promise<EmployeePayrollProfile | null> {
    const record = await prisma.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
      include: {
        components: {
          include: { component: true },
          where: { isActive: true },
        },
      },
    });
    return record ? this.toEntity(record) : null;
  }

  async findAll(filter: ProfileFilter): Promise<EmployeePayrollProfile[]> {
    const records = await prisma.employeePayrollProfile.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.employeeType && { employeeType: filter.employeeType }),
        ...(filter.payScheduleId && { payScheduleId: filter.payScheduleId }),
        ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      },
      include: {
        components: {
          include: { component: true },
          where: { isActive: true },
        },
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(data: EmployeePayrollProfile): Promise<EmployeePayrollProfile> {
    const record = await prisma.employeePayrollProfile.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        employeeType: data.employeeType,
        taxMethod: data.taxMethod,
        payScheduleId: data.payScheduleId,
        basicSalary: data.basicSalary,
        payPeriodDay: data.payPeriodDay,
        ptkpStatus: data.ptkpStatus,
        npwp: data.npwp,
        bpjsKesehatan: data.bpjsConfig.kesehatan,
        bpjsJht: data.bpjsConfig.jht,
        bpjsJp: data.bpjsConfig.jp,
        bpjsJkk: data.bpjsConfig.jkk,
        bpjsJkm: data.bpjsConfig.jkm,
        regionCode: data.regionCode,
        contractStart: data.contractStart,
        contractEnd: data.contractEnd,
        overtimeEligible: data.overtimeEligible,
        thrEligible: data.thrEligible,
      },
      include: {
        components: {
          include: { component: true },
          where: { isActive: true },
        },
      },
    });
    return this.toEntity(record);
  }

  async update(
    userId: string,
    tenantId: string,
    data: Partial<EmployeePayrollProfile>,
  ): Promise<EmployeePayrollProfile> {
    const existing = await prisma.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });
    if (!existing) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const updateData: Record<string, unknown> = {};

    if (data.employeeType !== undefined)
      updateData.employeeType = data.employeeType;
    if (data.taxMethod !== undefined) updateData.taxMethod = data.taxMethod;
    if (data.payScheduleId !== undefined)
      updateData.payScheduleId = data.payScheduleId;
    if (data.basicSalary !== undefined)
      updateData.basicSalary = data.basicSalary;
    if (data.payPeriodDay !== undefined)
      updateData.payPeriodDay = data.payPeriodDay;
    if (data.ptkpStatus !== undefined) updateData.ptkpStatus = data.ptkpStatus;
    if (data.npwp !== undefined) updateData.npwp = data.npwp;
    if (data.regionCode !== undefined) updateData.regionCode = data.regionCode;
    if (data.contractStart !== undefined)
      updateData.contractStart = data.contractStart;
    if (data.contractEnd !== undefined)
      updateData.contractEnd = data.contractEnd;
    if (data.overtimeEligible !== undefined)
      updateData.overtimeEligible = data.overtimeEligible;
    if (data.thrEligible !== undefined)
      updateData.thrEligible = data.thrEligible;

    if (data.bpjsConfig) {
      updateData.bpjsKesehatan = data.bpjsConfig.kesehatan;
      updateData.bpjsJht = data.bpjsConfig.jht;
      updateData.bpjsJp = data.bpjsConfig.jp;
      updateData.bpjsJkk = data.bpjsConfig.jkk;
      updateData.bpjsJkm = data.bpjsConfig.jkm;
    }

    const record = await prisma.employeePayrollProfile.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        components: {
          include: { component: true },
          where: { isActive: true },
        },
      },
    });
    return this.toEntity(record);
  }

  async assignComponent(
    userId: string,
    tenantId: string,
    component: EmployeeComponent,
  ): Promise<void> {
    const profile = await prisma.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    await prisma.employeeComponent.upsert({
      where: {
        profileId_componentId: {
          profileId: profile.id,
          componentId: component.componentId,
        },
      },
      create: {
        profileId: profile.id,
        tenantId,
        componentId: component.componentId,
        amount: component.amount,
        isActive: component.isActive,
      },
      update: {
        amount: component.amount,
        isActive: component.isActive,
      },
    });
  }

  async removeComponent(
    userId: string,
    tenantId: string,
    componentId: string,
  ): Promise<void> {
    const profile = await prisma.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });
    if (!profile) return;

    await prisma.employeeComponent.deleteMany({
      where: { profileId: profile.id, componentId },
    });
  }

  async updateComponent(
    userId: string,
    tenantId: string,
    componentId: string,
    data: Partial<EmployeeComponent>,
  ): Promise<void> {
    const profile = await prisma.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });
    if (!profile) return;

    const updateData: Record<string, unknown> = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await prisma.employeeComponent.updateMany({
      where: { profileId: profile.id, componentId },
      data: updateData,
    });
  }

  private toEntity(record: {
    userId: string;
    tenantId: string;
    employeeType: string;
    taxMethod: string;
    payScheduleId: string;
    basicSalary: number;
    payPeriodDay: number;
    ptkpStatus: string;
    npwp: string | null;
    bpjsKesehatan: boolean;
    bpjsJht: boolean;
    bpjsJp: boolean;
    bpjsJkk: boolean;
    bpjsJkm: boolean;
    regionCode: string;
    contractStart: Date;
    contractEnd: Date | null;
    overtimeEligible: boolean;
    thrEligible: boolean;
    components: Array<{
      componentId: string;
      amount: number | null;
      isActive: boolean;
      component: {
        code: string;
        name: string;
        category: string;
        calculationType: string;
      };
    }>;
  }): EmployeePayrollProfile {
    return {
      userId: record.userId,
      tenantId: record.tenantId,
      employeeType:
        record.employeeType as EmployeePayrollProfile["employeeType"],
      taxMethod: record.taxMethod as EmployeePayrollProfile["taxMethod"],
      payScheduleId: record.payScheduleId,
      basicSalary: record.basicSalary,
      payPeriodDay: record.payPeriodDay,
      ptkpStatus: record.ptkpStatus as EmployeePayrollProfile["ptkpStatus"],
      npwp: record.npwp,
      bpjsConfig: {
        kesehatan: record.bpjsKesehatan,
        jht: record.bpjsJht,
        jp: record.bpjsJp,
        jkk: record.bpjsJkk,
        jkm: record.bpjsJkm,
      },
      regionCode: record.regionCode,
      contractStart: record.contractStart,
      contractEnd: record.contractEnd,
      overtimeEligible: record.overtimeEligible,
      thrEligible: record.thrEligible,
      components: record.components.map((c) => ({
        componentId: c.componentId,
        componentCode: c.component.code,
        componentName: c.component.name,
        category: c.component.category as EmployeeComponent["category"],
        calculationType: c.component
          .calculationType as EmployeeComponent["calculationType"],
        amount: c.amount,
        isActive: c.isActive,
      })),
    };
  }
}
