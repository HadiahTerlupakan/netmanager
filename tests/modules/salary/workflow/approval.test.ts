import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PayrollApprovalService,
  type ApprovalWorkflow,
  type IApprovalWorkflowRepository,
} from "@/modules/salary/workflow/approval/PayrollApprovalService";

function createMockRepository(): IApprovalWorkflowRepository {
  let stored: ApprovalWorkflow | null = null;

  return {
    findByPayrollRunId: vi.fn(async () => stored),
    save: vi.fn(async (workflow: ApprovalWorkflow) => {
      stored = workflow;
      return workflow;
    }),
  };
}

describe("PayrollApprovalService", () => {
  let service: PayrollApprovalService;
  let repo: IApprovalWorkflowRepository;

  beforeEach(() => {
    repo = createMockRepository();
    service = new PayrollApprovalService(repo);
  });

  describe("createWorkflow", () => {
    it("should create a workflow with ordered steps", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [
          { order: 2, approverRole: "FINANCE_MANAGER" },
          { order: 1, approverRole: "HR_MANAGER" },
        ],
      });

      expect(workflow.payrollRunId).toBe("run-1");
      expect(workflow.tenantId).toBe("tenant-1");
      expect(workflow.status).toBe("PENDING");
      expect(workflow.currentStep).toBe(1);
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].approverRole).toBe("HR_MANAGER");
      expect(workflow.steps[1].approverRole).toBe("FINANCE_MANAGER");
    });

    it("should throw if no steps provided", async () => {
      await expect(
        service.createWorkflow("run-1", "tenant-1", { steps: [] }),
      ).rejects.toThrow("at least one step");
    });

    it("should set auto-approve threshold", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
        autoApproveThreshold: 10000000,
      });

      expect(workflow.autoApproveThreshold).toBe(10000000);
    });
  });

  describe("shouldAutoApprove", () => {
    it("should return true when below threshold", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
        autoApproveThreshold: 50000000,
      });

      expect(service.shouldAutoApprove(workflow, 30000000)).toBe(true);
    });

    it("should return false when above threshold", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
        autoApproveThreshold: 50000000,
      });

      expect(service.shouldAutoApprove(workflow, 60000000)).toBe(false);
    });

    it("should return false when no threshold configured", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      expect(service.shouldAutoApprove(workflow, 1000)).toBe(false);
    });
  });

  describe("autoApprove", () => {
    it("should mark all steps as approved", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [
          { order: 1, approverRole: "HR_MANAGER" },
          { order: 2, approverRole: "FINANCE_MANAGER" },
        ],
        autoApproveThreshold: 50000000,
      });

      const result = await service.autoApprove(workflow, "system");

      expect(result.success).toBe(true);
      expect(result.isFullyApproved).toBe(true);
      expect(result.workflow.status).toBe("APPROVED");
      expect(result.workflow.steps.every((s) => s.isCompleted)).toBe(true);
      expect(result.workflow.steps.every((s) => s.action === "APPROVE")).toBe(
        true,
      );
    });
  });

  describe("canUserApprove", () => {
    it("should allow user with matching role at current step", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      expect(service.canUserApprove(workflow, "user-1", "HR_MANAGER")).toBe(
        true,
      );
    });

    it("should reject user with wrong role", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      expect(
        service.canUserApprove(workflow, "user-1", "FINANCE_MANAGER"),
      ).toBe(false);
    });

    it("should reject if specific approver is set and user does not match", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [
          { order: 1, approverRole: "HR_MANAGER", approverId: "user-99" },
        ],
      });

      expect(service.canUserApprove(workflow, "user-1", "HR_MANAGER")).toBe(
        false,
      );
    });

    it("should reject if workflow is not pending", async () => {
      const workflow = await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });
      workflow.status = "APPROVED";

      expect(service.canUserApprove(workflow, "user-1", "HR_MANAGER")).toBe(
        false,
      );
    });
  });

  describe("performAction", () => {
    it("should approve and advance to next step", async () => {
      await service.createWorkflow("run-1", "tenant-1", {
        steps: [
          { order: 1, approverRole: "HR_MANAGER" },
          { order: 2, approverRole: "FINANCE_MANAGER" },
        ],
      });

      const result = await service.performAction(
        "run-1",
        "tenant-1",
        "user-1",
        "HR_MANAGER",
        "APPROVE",
        "Looks good",
      );

      expect(result.success).toBe(true);
      expect(result.isFullyApproved).toBe(false);
      expect(result.nextStep?.approverRole).toBe("FINANCE_MANAGER");
      expect(result.workflow.currentStep).toBe(2);
    });

    it("should fully approve on last step", async () => {
      await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      const result = await service.performAction(
        "run-1",
        "tenant-1",
        "user-1",
        "HR_MANAGER",
        "APPROVE",
      );

      expect(result.success).toBe(true);
      expect(result.isFullyApproved).toBe(true);
      expect(result.workflow.status).toBe("APPROVED");
    });

    it("should reject the workflow", async () => {
      await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      const result = await service.performAction(
        "run-1",
        "tenant-1",
        "user-1",
        "HR_MANAGER",
        "REJECT",
        "Numbers don't add up",
      );

      expect(result.success).toBe(true);
      expect(result.isFullyApproved).toBe(false);
      expect(result.workflow.status).toBe("REJECTED");
    });

    it("should request revision", async () => {
      await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      const result = await service.performAction(
        "run-1",
        "tenant-1",
        "user-1",
        "HR_MANAGER",
        "REQUEST_REVISION",
        "Please fix overtime entries",
      );

      expect(result.success).toBe(true);
      expect(result.workflow.status).toBe("REVISION_REQUESTED");
    });

    it("should throw if no workflow found", async () => {
      await expect(
        service.performAction(
          "nonexistent",
          "tenant-1",
          "user-1",
          "HR_MANAGER",
          "APPROVE",
        ),
      ).rejects.toThrow("No approval workflow found");
    });

    it("should throw if user cannot approve", async () => {
      await service.createWorkflow("run-1", "tenant-1", {
        steps: [{ order: 1, approverRole: "HR_MANAGER" }],
      });

      await expect(
        service.performAction(
          "run-1",
          "tenant-1",
          "user-1",
          "WRONG_ROLE",
          "APPROVE",
        ),
      ).rejects.toThrow("cannot approve");
    });
  });

  describe("mapToPayrollStatus", () => {
    it("should map workflow statuses correctly", () => {
      expect(service.mapToPayrollStatus("PENDING")).toBe("AUDITED");
      expect(service.mapToPayrollStatus("APPROVED")).toBe("APPROVED");
      expect(service.mapToPayrollStatus("REJECTED")).toBe("REJECTED");
      expect(service.mapToPayrollStatus("REVISION_REQUESTED")).toBe(
        "REVISION_REQUESTED",
      );
    });
  });
});
