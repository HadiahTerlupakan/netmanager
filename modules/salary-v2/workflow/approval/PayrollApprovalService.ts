import type { PayrollRunStatus } from "@/modules/salary-v2/core";

// --- Types ---

export type ApprovalAction = "APPROVE" | "REJECT" | "REQUEST_REVISION";

export interface ApprovalStep {
  order: number;
  approverRole: string;
  approverId: string | null; // null = any user with the role
  isCompleted: boolean;
  action: ApprovalAction | null;
  actionBy: string | null;
  actionAt: Date | null;
  notes: string | null;
}

export interface ApprovalWorkflow {
  payrollRunId: string;
  tenantId: string;
  currentStep: number;
  steps: ApprovalStep[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  autoApproveThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalConfig {
  steps: Array<{
    order: number;
    approverRole: string;
    approverId?: string;
  }>;
  autoApproveThreshold?: number;
}

export interface ApprovalActionResult {
  success: boolean;
  workflow: ApprovalWorkflow;
  isFullyApproved: boolean;
  nextStep: ApprovalStep | null;
  message: string;
}

/** Port for persisting approval workflows */
export interface IApprovalWorkflowRepository {
  findByPayrollRunId(
    payrollRunId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflow | null>;
  save(workflow: ApprovalWorkflow): Promise<ApprovalWorkflow>;
}

// --- Service ---

/** Manages multi-step payroll approval workflows */
export class PayrollApprovalService {
  constructor(private readonly repository: IApprovalWorkflowRepository) {}

  /** Create a new approval workflow for a payroll run */
  async createWorkflow(
    payrollRunId: string,
    tenantId: string,
    config: ApprovalConfig,
  ): Promise<ApprovalWorkflow> {
    if (config.steps.length === 0) {
      throw new Error("Approval workflow must have at least one step");
    }

    const sortedSteps = [...config.steps].sort((a, b) => a.order - b.order);

    const workflow: ApprovalWorkflow = {
      payrollRunId,
      tenantId,
      currentStep: sortedSteps[0].order,
      steps: sortedSteps.map(
        (s): ApprovalStep => ({
          order: s.order,
          approverRole: s.approverRole,
          approverId: s.approverId ?? null,
          isCompleted: false,
          action: null,
          actionBy: null,
          actionAt: null,
          notes: null,
        }),
      ),
      status: "PENDING",
      autoApproveThreshold: config.autoApproveThreshold ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.repository.save(workflow);
  }

  /** Check if a payroll run qualifies for auto-approval */
  shouldAutoApprove(
    workflow: ApprovalWorkflow,
    totalNetSalary: number,
  ): boolean {
    if (workflow.autoApproveThreshold === null) return false;
    return totalNetSalary <= workflow.autoApproveThreshold;
  }

  /** Auto-approve all steps in the workflow */
  async autoApprove(
    workflow: ApprovalWorkflow,
    systemUserId: string,
  ): Promise<ApprovalActionResult> {
    const now = new Date();

    for (const step of workflow.steps) {
      step.isCompleted = true;
      step.action = "APPROVE";
      step.actionBy = systemUserId;
      step.actionAt = now;
      step.notes = "Auto-approved (below threshold)";
    }

    workflow.status = "APPROVED";
    workflow.currentStep = workflow.steps[workflow.steps.length - 1].order;
    workflow.updatedAt = now;

    const saved = await this.repository.save(workflow);

    return {
      success: true,
      workflow: saved,
      isFullyApproved: true,
      nextStep: null,
      message: "Payroll auto-approved (below threshold)",
    };
  }

  /** Validate if a user can perform an action at the current step */
  canUserApprove(
    workflow: ApprovalWorkflow,
    userId: string,
    userRole: string,
  ): boolean {
    if (workflow.status !== "PENDING") return false;

    const currentStep = workflow.steps.find(
      (s) => s.order === workflow.currentStep,
    );
    if (!currentStep || currentStep.isCompleted) return false;

    // Check role match
    if (currentStep.approverRole !== userRole) return false;

    // Check specific approver if set
    if (currentStep.approverId && currentStep.approverId !== userId) {
      return false;
    }

    return true;
  }

  /** Perform an approval action on the current step */
  async performAction(
    payrollRunId: string,
    tenantId: string,
    userId: string,
    userRole: string,
    action: ApprovalAction,
    notes?: string,
  ): Promise<ApprovalActionResult> {
    const workflow = await this.repository.findByPayrollRunId(
      payrollRunId,
      tenantId,
    );

    if (!workflow) {
      throw new Error(
        `No approval workflow found for payroll run ${payrollRunId}`,
      );
    }

    if (!this.canUserApprove(workflow, userId, userRole)) {
      throw new Error(
        `User ${userId} (role: ${userRole}) cannot approve at current step`,
      );
    }

    const currentStep = workflow.steps.find(
      (s) => s.order === workflow.currentStep,
    )!;

    const now = new Date();
    currentStep.isCompleted = true;
    currentStep.action = action;
    currentStep.actionBy = userId;
    currentStep.actionAt = now;
    currentStep.notes = notes ?? null;
    workflow.updatedAt = now;

    if (action === "REJECT") {
      workflow.status = "REJECTED";
      const saved = await this.repository.save(workflow);
      return {
        success: true,
        workflow: saved,
        isFullyApproved: false,
        nextStep: null,
        message: `Payroll rejected by ${userId}`,
      };
    }

    if (action === "REQUEST_REVISION") {
      workflow.status = "REVISION_REQUESTED";
      const saved = await this.repository.save(workflow);
      return {
        success: true,
        workflow: saved,
        isFullyApproved: false,
        nextStep: null,
        message: `Revision requested by ${userId}`,
      };
    }

    // APPROVE — advance to next step or complete
    const nextStepDef = workflow.steps.find(
      (s) => s.order > currentStep.order && !s.isCompleted,
    );

    if (nextStepDef) {
      workflow.currentStep = nextStepDef.order;
      const saved = await this.repository.save(workflow);
      return {
        success: true,
        workflow: saved,
        isFullyApproved: false,
        nextStep: nextStepDef,
        message: `Step ${currentStep.order} approved. Awaiting step ${nextStepDef.order} (${nextStepDef.approverRole})`,
      };
    }

    // All steps completed
    workflow.status = "APPROVED";
    const saved = await this.repository.save(workflow);
    return {
      success: true,
      workflow: saved,
      isFullyApproved: true,
      nextStep: null,
      message: "Payroll fully approved",
    };
  }

  /** Get the current workflow status */
  async getWorkflow(
    payrollRunId: string,
    tenantId: string,
  ): Promise<ApprovalWorkflow | null> {
    return this.repository.findByPayrollRunId(payrollRunId, tenantId);
  }

  /** Map workflow status to PayrollRunStatus */
  mapToPayrollStatus(
    workflowStatus: ApprovalWorkflow["status"],
  ): PayrollRunStatus {
    const map: Record<ApprovalWorkflow["status"], PayrollRunStatus> = {
      PENDING: "AUDITED",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      REVISION_REQUESTED: "REVISION_REQUESTED",
    };
    return map[workflowStatus];
  }
}
