import { PlanningRepository } from "../repositories/PlanningRepository";
import { PlanningItemRepository } from "../repositories/PlanningItemRepository";
import { PlanningMilestoneRepository } from "../repositories/PlanningMilestoneRepository";
import { PlanningDocumentRepository } from "../repositories/PlanningDocumentRepository";
import { PlanningAuditLogRepository } from "../repositories/PlanningAuditLogRepository";
import { PlanningTemplateRepository } from "../repositories/PlanningTemplateRepository";
import { PlanningTemplateItemRepository } from "../repositories/PlanningTemplateItemRepository";
import { PrismaPlanningUnitOfWork } from "../repositories/PrismaPlanningUnitOfWork";

import { PlanningAuditService } from "./PlanningAuditService";
import { PlanningService } from "./PlanningService";
import { PlanningItemService } from "./PlanningItemService";
import { PlanningMilestoneService } from "./PlanningMilestoneService";
import { PlanningApprovalService } from "./PlanningApprovalService";
import { PlanningTemplateService } from "./PlanningTemplateService";
import { PlanningKanbanService } from "./PlanningKanbanService";
import { PlanningDashboardService } from "./PlanningDashboardService";

/**
 * PlanningServiceFactory
 * Factory untuk dependency injection dan singleton service instances.
 * Mengikuti pattern singleton untuk memastikan hanya ada 1 instance per service.
 */
class PlanningServiceFactory {
  private static instances = new Map<string, unknown>();

  /** Unit of work bersama — stateless, aman dipakai ulang semua service. */
  private static getUnitOfWork(): PrismaPlanningUnitOfWork {
    if (!this.instances.has("unitOfWork")) {
      this.instances.set("unitOfWork", new PrismaPlanningUnitOfWork());
    }
    return this.instances.get("unitOfWork") as PrismaPlanningUnitOfWork;
  }

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
          this.getUnitOfWork(),
        ),
      );
    }
    return this.instances.get("planning") as PlanningService;
  }

  /**
   * Get PlanningItemService singleton
   */
  static getItemService(): PlanningItemService {
    if (!this.instances.has("item")) {
      this.instances.set(
        "item",
        new PlanningItemService(
          new PlanningRepository(),
          new PlanningItemRepository(),
          this.getAuditService(),
          this.getUnitOfWork(),
        ),
      );
    }
    return this.instances.get("item") as PlanningItemService;
  }

  /**
   * Get PlanningMilestoneService singleton
   */
  static getMilestoneService(): PlanningMilestoneService {
    if (!this.instances.has("milestone")) {
      this.instances.set(
        "milestone",
        new PlanningMilestoneService(
          new PlanningRepository(),
          new PlanningMilestoneRepository(),
          this.getAuditService(),
          this.getUnitOfWork(),
        ),
      );
    }
    return this.instances.get("milestone") as PlanningMilestoneService;
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
          this.getUnitOfWork(),
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
      const itemRepo = new PlanningItemRepository();
      const auditService = this.getAuditService();

      this.instances.set(
        "template",
        new PlanningTemplateService(
          templateRepo,
          templateItemRepo,
          planningRepo,
          itemRepo,
          auditService,
          this.getUnitOfWork(),
        ),
      );
    }
    return this.instances.get("template") as PlanningTemplateService;
  }

  /**
   * Get PlanningKanbanService singleton
   */
  static getKanbanService(): PlanningKanbanService {
    if (!this.instances.has("kanban")) {
      const planningRepo = new PlanningRepository();
      this.instances.set("kanban", new PlanningKanbanService(planningRepo));
    }
    return this.instances.get("kanban") as PlanningKanbanService;
  }

  /**
   * Get PlanningDashboardService singleton
   */
  static getDashboardService(): PlanningDashboardService {
    if (!this.instances.has("dashboard")) {
      const planningRepo = new PlanningRepository();
      this.instances.set(
        "dashboard",
        new PlanningDashboardService(planningRepo),
      );
    }
    return this.instances.get("dashboard") as PlanningDashboardService;
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
export const planningItemService = PlanningServiceFactory.getItemService();
export const planningMilestoneService =
  PlanningServiceFactory.getMilestoneService();
export const planningApprovalService =
  PlanningServiceFactory.getApprovalService();
export const planningTemplateService =
  PlanningServiceFactory.getTemplateService();
export const planningKanbanService = PlanningServiceFactory.getKanbanService();
export const planningDashboardService =
  PlanningServiceFactory.getDashboardService();

// Export factory untuk testing
export { PlanningServiceFactory };
