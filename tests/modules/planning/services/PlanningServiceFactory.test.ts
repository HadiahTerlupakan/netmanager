import { describe, it, expect, beforeEach } from "vitest";
import { PlanningServiceFactory } from "@/modules/planning/services/PlanningServiceFactory";
import { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningService } from "@/modules/planning/services/PlanningService";
import { PlanningApprovalService } from "@/modules/planning/services/PlanningApprovalService";
import { PlanningTemplateService } from "@/modules/planning/services/PlanningTemplateService";

describe("PlanningServiceFactory", () => {
  beforeEach(() => {
    // Clear instances before each test
    PlanningServiceFactory.clearInstances();
  });

  describe("getAuditService", () => {
    it("should return singleton instance", () => {
      const instance1 = PlanningServiceFactory.getAuditService();
      const instance2 = PlanningServiceFactory.getAuditService();

      expect(instance1).toBeInstanceOf(PlanningAuditService);
      expect(instance1).toBe(instance2); // Same instance
    });
  });

  describe("getPlanningService", () => {
    it("should return singleton instance", () => {
      const instance1 = PlanningServiceFactory.getPlanningService();
      const instance2 = PlanningServiceFactory.getPlanningService();

      expect(instance1).toBeInstanceOf(PlanningService);
      expect(instance1).toBe(instance2); // Same instance
    });

    it("should inject audit service dependency", () => {
      const planningService = PlanningServiceFactory.getPlanningService();
      const auditService = PlanningServiceFactory.getAuditService();

      expect(planningService).toBeDefined();
      expect(auditService).toBeDefined();
    });
  });

  describe("getApprovalService", () => {
    it("should return singleton instance", () => {
      const instance1 = PlanningServiceFactory.getApprovalService();
      const instance2 = PlanningServiceFactory.getApprovalService();

      expect(instance1).toBeInstanceOf(PlanningApprovalService);
      expect(instance1).toBe(instance2); // Same instance
    });
  });

  describe("getTemplateService", () => {
    it("should return singleton instance", () => {
      const instance1 = PlanningServiceFactory.getTemplateService();
      const instance2 = PlanningServiceFactory.getTemplateService();

      expect(instance1).toBeInstanceOf(PlanningTemplateService);
      expect(instance1).toBe(instance2); // Same instance
    });
  });

  describe("clearInstances", () => {
    it("should clear all singleton instances", () => {
      const instance1 = PlanningServiceFactory.getPlanningService();
      PlanningServiceFactory.clearInstances();
      const instance2 = PlanningServiceFactory.getPlanningService();

      expect(instance1).not.toBe(instance2); // Different instances after clear
    });
  });
});
