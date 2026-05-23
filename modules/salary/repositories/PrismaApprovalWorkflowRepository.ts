import { prisma } from "@/lib/prisma";
import type {
  IApprovalWorkflowRepository,
  ApprovalWorkflow,
  ApprovalStep,
} from "../workflow/approval/PayrollApprovalService";

export class PrismaApprovalWorkflowRepository implements IApprovalWorkflowRepository {
  async findByPayrollRunId(
    payrollRunId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflow | null> {
    const record = await prisma.payrollApprovalWorkflow.findFirst({
      where: { payrollRunId, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(workflow: ApprovalWorkflow): Promise<ApprovalWorkflow> {
    const record = await prisma.payrollApprovalWorkflow.upsert({
      where: { payrollRunId: workflow.payrollRunId },
      create: {
        payrollRunId: workflow.payrollRunId,
        tenantId: workflow.tenantId,
        currentStep: workflow.currentStep,
        steps: JSON.parse(JSON.stringify(workflow.steps)),
        status: workflow.status,
        autoApproveThreshold: workflow.autoApproveThreshold,
      },
      update: {
        currentStep: workflow.currentStep,
        steps: JSON.parse(JSON.stringify(workflow.steps)),
        status: workflow.status,
        autoApproveThreshold: workflow.autoApproveThreshold,
      },
    });
    return this.toEntity(record);
  }

  private toEntity(record: {
    id: string;
    payrollRunId: string;
    tenantId: string;
    currentStep: number;
    steps: unknown;
    status: string;
    autoApproveThreshold: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): ApprovalWorkflow {
    return {
      payrollRunId: record.payrollRunId,
      tenantId: record.tenantId,
      currentStep: record.currentStep,
      steps: record.steps as ApprovalStep[],
      status: record.status as ApprovalWorkflow["status"],
      autoApproveThreshold: record.autoApproveThreshold,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
