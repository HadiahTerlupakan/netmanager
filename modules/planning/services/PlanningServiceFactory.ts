import { PlanningRepository } from "../repositories/PlanningRepository";
import { PlanningItemRepository } from "../repositories/PlanningItemRepository";
import { PlanningMilestoneRepository } from "../repositories/PlanningMilestoneRepository";
import { PlanningDocumentRepository } from "../repositories/PlanningDocumentRepository";
import { PlanningAuditLogRepository } from "../repositories/PlanningAuditLogRepository";
import { PlanningTemplateRepository } from "../repositories/PlanningTemplateRepository";
import { PlanningTemplateItemRepository } from "../repositories/PlanningTemplateItemRepository";

import { PlanningAuditService } from "./PlanningAuditService";
import { PlanningService } from "./PlanningService";
import { PlanningApprovalService } from "./PlanningApprovalService";
import { PlanningTemplateService } from "./PlanningTemplateService";

/**
 * PlanningServiceFactory
 * Factory untuk dependency injection dan singleton service instances.
 * Mengikuti pattern singleton untuk memastikan hanya ada 1 instance per service.
 */
class PlanningServiceFactory {
  private static instances = new Map<string, unknown>();

  /**
   * Get PlanningAuditService singleton
   */
  static getAuditService(): PlanningAuditService {
    if (!this.instances.has("audit")) {
      const auditLogRepo = new PlanningAuditLogRepository();
      this.instances.set("audit", new PlanningAuditService(auditLogRepo));
    }
    return this.instances.get("audit") as PlanningAuditService;
  }

  /**
   * Get PlanningService singleton
   */
  static getPlanningService(): PlanningService {
    if (!this.instances.has("planning")) {
      const planningRepo = new PlanningRepository();
      const itemRepo = new PlanningItemRepository();
      const milestoneRepo = new PlanningMilestoneRepository();
      const documentRepo = new PlanningDocumentRepository();
      const auditService = this.getAuditService();

      this.instances.set(
        "planning",
        new PlanningService(
          planningRepo,
          itemRepo,
          milestoneRepo,
          documentRepo,
          auditService,
        ),
      );
    }
    return this.instances.get("planning") as PlanningService;
  }

  /**
   * Get PlanningApprovalService singleton
   */
  static getApprovalService(): PlanningApprovalService {
    if (!this.instances.has("approval")) {
      const planningRepo = new PlanningRepository();
      const itemRepo = new PlanningItemRepository();
      const milestoneRepo = new PlanningMilestoneRepository();
      const documentRepo = new PlanningDocumentRepository();
      const auditService = this.getAuditService();

      this.instances.set(
        "approval",
        new PlanningApprovalService(
          planningRepo,
          itemRepo,
          milestoneRepo,
          documentRepo,
          auditService,
        ),
      );
    }
    return this.instances.get("approval") as PlanningApprovalService;
  }

  /**
   * Get PlanningTemplateService singleton
   */
  static getTemplateService(): PlanningTemplateService {
    if (!this.instances.has("template")) {
      const templateRepo = new PlanningTemplateRepository();
      const templateItemRepo = new PlanningTemplateItemRepository();
      const planningRepo = new PlanningRepository();
      const auditService = this.getAuditService();

      this.instances.set(
        "template",
        new PlanningTemplateService(
          templateRepo,
          templateItemRepo,
          planningRepo,
          auditService,
        ),
      );
    }
    return this.instances.get("template") as PlanningTemplateService;
  }

  /**
   * Clear all singleton instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}

// Export singleton instances untuk direct import
export const planningAuditService = PlanningServiceFactory.getAuditService();
export const planningService = PlanningServiceFactory.getPlanningService();
export const planningApprovalService =
  PlanningServiceFactory.getApprovalService();
export const planningTemplateService =
  PlanningServiceFactory.getTemplateService();

// Export factory untuk testing
export { PlanningServiceFactory };
