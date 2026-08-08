import { describe, it, expect } from "vitest";
import {
  PlanningEntity,
  type PlanningEntityProps,
} from "@/modules/planning/domain/entities/PlanningEntity";

const createBasePlanningProps = (
  overrides?: Partial<PlanningEntityProps>,
): PlanningEntityProps => ({
  id: "plan-1",
  tenantId: "tenant-1",
  type: "OSP",
  title: "Test Planning",
  description: "Test description",
  area: "Area A",
  coordinates: { latitude: -6.2, longitude: 106.8 },
  estimatedUnits: 100,
  estimatedBudget: 50000000,
  actualBudget: null,
  status: "BACKLOG",
  approvalLevel: 1,
  currentApprovalStep: 0,
  submittedAt: null,
  submittedById: null,
  approvedAt: null,
  approvedById: null,
  approvedLevel1At: null,
  approvedLevel1ById: null,
  rejectedAt: null,
  rejectedById: null,
  approvalNotes: null,
  progressPercentage: 0,
  startDate: null,
  targetCompletionDate: null,
  actualCompletionDate: null,
  createdById: "user-1",
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  deletedAt: null,
  ...overrides,
});

describe("PlanningEntity", () => {
  describe("Status checks", () => {
    it("should correctly identify BACKLOG status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "BACKLOG" }),
      );
      expect(planning.isBacklog()).toBe(true);
      expect(planning.isApproved()).toBe(false);
      expect(planning.isPendingApproval()).toBe(false);
    });

    it("should correctly identify PENDING_APPROVAL status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "PENDING_APPROVAL" }),
      );
      expect(planning.isPendingApproval()).toBe(true);
      expect(planning.isBacklog()).toBe(false);
    });

    it("should correctly identify APPROVED_LEVEL1 status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED_LEVEL1" }),
      );
      expect(planning.isApprovedLevel1()).toBe(true);
      expect(planning.isApproved()).toBe(false);
    });

    it("should correctly identify APPROVED status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED" }),
      );
      expect(planning.isApproved()).toBe(true);
      expect(planning.isPendingApproval()).toBe(false);
    });

    it("should correctly identify IN_PROGRESS status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "IN_PROGRESS" }),
      );
      expect(planning.isInProgress()).toBe(true);
      expect(planning.isCompleted()).toBe(false);
    });

    it("should correctly identify COMPLETED status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "COMPLETED" }),
      );
      expect(planning.isCompleted()).toBe(true);
      expect(planning.isInProgress()).toBe(false);
    });

    it("should correctly identify REJECTED status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "REJECTED" }),
      );
      expect(planning.isRejected()).toBe(true);
      expect(planning.isApproved()).toBe(false);
    });

    it("should correctly identify CANCELLED status", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "CANCELLED" }),
      );
      expect(planning.isCancelled()).toBe(true);
    });
  });

  describe("Approval workflow", () => {
    it("should require second approval when approval level is 2 and current step is 1", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          approvalLevel: 2,
          currentApprovalStep: 1,
          status: "APPROVED_LEVEL1",
        }),
      );
      expect(planning.requiresSecondApproval()).toBe(true);
    });

    it("should not require second approval when approval level is 1", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          approvalLevel: 1,
          currentApprovalStep: 0,
        }),
      );
      expect(planning.requiresSecondApproval()).toBe(false);
    });

    it("should not require second approval when current step is 0", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          approvalLevel: 2,
          currentApprovalStep: 0,
        }),
      );
      expect(planning.requiresSecondApproval()).toBe(false);
    });

    it("should not require second approval when current step is 2", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          approvalLevel: 2,
          currentApprovalStep: 2,
        }),
      );
      expect(planning.requiresSecondApproval()).toBe(false);
    });

    it("should allow approval when status is PENDING_APPROVAL", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "PENDING_APPROVAL" }),
      );
      expect(planning.canBeApproved()).toBe(true);
    });

    it("should allow approval when status is APPROVED_LEVEL1", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED_LEVEL1" }),
      );
      expect(planning.canBeApproved()).toBe(true);
    });

    it("should not allow approval when status is BACKLOG", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "BACKLOG" }),
      );
      expect(planning.canBeApproved()).toBe(false);
    });

    it("should allow rejection when status is PENDING_APPROVAL", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "PENDING_APPROVAL" }),
      );
      expect(planning.canBeRejected()).toBe(true);
    });

    it("should allow rejection when status is APPROVED_LEVEL1", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED_LEVEL1" }),
      );
      expect(planning.canBeRejected()).toBe(true);
    });
  });

  describe("Edit permissions", () => {
    it("should allow editing when status is BACKLOG", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "BACKLOG" }),
      );
      expect(planning.canBeEdited()).toBe(true);
    });

    it("should allow editing when status is REJECTED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "REJECTED" }),
      );
      expect(planning.canBeEdited()).toBe(true);
    });

    it("should not allow editing when status is PENDING_APPROVAL", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "PENDING_APPROVAL" }),
      );
      expect(planning.canBeEdited()).toBe(false);
    });

    it("should not allow editing when status is APPROVED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED" }),
      );
      expect(planning.canBeEdited()).toBe(false);
    });

    it("should not allow editing when status is IN_PROGRESS", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "IN_PROGRESS" }),
      );
      expect(planning.canBeEdited()).toBe(false);
    });

    it("should not allow editing when status is COMPLETED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "COMPLETED" }),
      );
      expect(planning.canBeEdited()).toBe(false);
    });

    it("should allow submission when status is BACKLOG", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "BACKLOG" }),
      );
      expect(planning.canBeSubmitted()).toBe(true);
    });

    it("should allow submission when status is REJECTED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "REJECTED" }),
      );
      expect(planning.canBeSubmitted()).toBe(true);
    });

    it("should not allow submission when status is PENDING_APPROVAL", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "PENDING_APPROVAL" }),
      );
      expect(planning.canBeSubmitted()).toBe(false);
    });

    it("should not allow submission when status is APPROVED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED" }),
      );
      expect(planning.canBeSubmitted()).toBe(false);
    });
  });

  describe("Workflow state transitions", () => {
    it("should allow starting progress when status is APPROVED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "APPROVED" }),
      );
      expect(planning.canStartProgress()).toBe(true);
    });

    it("should not allow starting progress when status is not APPROVED", () => {
      const statuses = [
        "BACKLOG",
        "PENDING_APPROVAL",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
      ] as const;

      statuses.forEach((status) => {
        const planning = new PlanningEntity(
          createBasePlanningProps({ status }),
        );
        expect(planning.canStartProgress()).toBe(false);
      });
    });

    it("should allow cancellation for non-final statuses", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "IN_PROGRESS" }),
      );
      expect(planning.canBeCancelled()).toBe(true);
    });

    it("should not allow cancellation when COMPLETED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "COMPLETED" }),
      );
      expect(planning.canBeCancelled()).toBe(false);
    });

    it("should not allow cancellation when already CANCELLED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "CANCELLED" }),
      );
      expect(planning.canBeCancelled()).toBe(false);
    });

    it("should not allow cancellation when REJECTED", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({ status: "REJECTED" }),
      );
      expect(planning.canBeCancelled()).toBe(false);
    });
  });

  describe("Budget calculations", () => {
    it("should detect over budget when actual exceeds estimated", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: 60000000,
        }),
      );
      expect(planning.isOverBudget()).toBe(true);
    });

    it("should not detect over budget when actual is less than estimated", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: 45000000,
        }),
      );
      expect(planning.isOverBudget()).toBe(false);
    });

    it("should return null for over budget check when no actual budget", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: null,
        }),
      );
      expect(planning.isOverBudget()).toBe(false);
    });

    it("should calculate budget variance correctly", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: 55000000,
        }),
      );
      expect(planning.getBudgetVariance()).toBe(5000000);
    });

    it("should calculate negative budget variance when under budget", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: 45000000,
        }),
      );
      expect(planning.getBudgetVariance()).toBe(-5000000);
    });

    it("should return null for budget variance when no actual budget", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: null,
        }),
      );
      expect(planning.getBudgetVariance()).toBe(null);
    });

    it("should calculate budget variance percentage correctly", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 50000000,
          actualBudget: 55000000,
        }),
      );
      expect(planning.getBudgetVariancePercentage()).toBe(10);
    });

    it("should return null for variance percentage when estimated is zero", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          estimatedBudget: 0,
          actualBudget: 10000,
        }),
      );
      expect(planning.getBudgetVariancePercentage()).toBe(null);
    });
  });

  describe("Date checks", () => {
    it("should detect overdue when past target date and not completed", () => {
      const pastDate = new Date("2026-01-01");
      const planning = new PlanningEntity(
        createBasePlanningProps({
          status: "IN_PROGRESS",
          targetCompletionDate: pastDate,
          actualCompletionDate: null,
        }),
      );
      expect(planning.isOverdue()).toBe(true);
    });

    it("should not detect overdue when completed", () => {
      const pastDate = new Date("2026-01-01");
      const planning = new PlanningEntity(
        createBasePlanningProps({
          status: "COMPLETED",
          targetCompletionDate: pastDate,
          actualCompletionDate: new Date("2026-08-01"),
        }),
      );
      expect(planning.isOverdue()).toBe(false);
    });

    it("should not detect overdue when target date is in future", () => {
      const futureDate = new Date("2027-01-01");
      const planning = new PlanningEntity(
        createBasePlanningProps({
          status: "IN_PROGRESS",
          targetCompletionDate: futureDate,
          actualCompletionDate: null,
        }),
      );
      expect(planning.isOverdue()).toBe(false);
    });

    it("should not detect overdue when no target date set", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          status: "IN_PROGRESS",
          targetCompletionDate: null,
          actualCompletionDate: null,
        }),
      );
      expect(planning.isOverdue()).toBe(false);
    });
  });

  describe("Soft delete", () => {
    it("should detect deleted when deletedAt is set", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          deletedAt: new Date("2026-08-01"),
        }),
      );
      expect(planning.isDeleted()).toBe(true);
    });

    it("should not detect deleted when deletedAt is null", () => {
      const planning = new PlanningEntity(
        createBasePlanningProps({
          deletedAt: null,
        }),
      );
      expect(planning.isDeleted()).toBe(false);
    });
  });
});
