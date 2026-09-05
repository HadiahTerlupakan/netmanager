import type {
  PlanningType,
  PlanningStatus,
} from "../domain/entities/PlanningEntity";
import type { PlanningItemDTO } from "./PlanningItemDTO";
import type { PlanningMilestoneDTO } from "./PlanningMilestoneDTO";
import type { PlanningDocumentDTO } from "./PlanningDocumentDTO";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * PlanningListItemDTO - Summary view for list endpoints
 * Contains only essential fields for displaying planning records in tables/grids
 */
export interface PlanningListItemDTO {
  id: string;
  type: PlanningType;
  title: string;
  area: string;
  status: PlanningStatus;
  estimatedUnits: number;
  estimatedBudget: number | null;
  actualBudget: number | null;
  progressPercentage: number;
  startDate: string | null;
  targetCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * PlanningDetailDTO - Complete view with all fields and relations
 * Used for detail pages and edit forms
 */
export interface PlanningDetailDTO extends PlanningListItemDTO {
  description: string | null;
  coordinates: Coordinates | null;
  approvalLevel: number;
  currentApprovalStep: number;
  submittedAt: string | null;
  submittedById: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  approvedLevel1At: string | null;
  approvedLevel1ById: string | null;
  rejectedAt: string | null;
  rejectedById: string | null;
  approvalNotes: string | null;
  actualCompletionDate: string | null;
  createdById: string | null;

  /**
   * Total biaya estimasi hasil penjumlahan seluruh item (BOQ).
   * Diturunkan, bukan disimpan — supaya tidak bisa berbeda dari item-nya.
   */
  itemsTotalEstimatedCost: number;

  /**
   * Menandai `estimatedBudget` di header berbeda dari total BOQ. Nilai header
   * tidak ditimpa: ia bisa memuat komponen di luar BOQ, jadi yang dibutuhkan
   * adalah selisihnya terlihat, bukan disembunyikan.
   */
  hasBudgetMismatch: boolean;

  /**
   * Progres yang dihitung dari milestone berstatus COMPLETED, atau null bila
   * belum ada milestone. Berbeda dari `progressPercentage` yang diketik manual.
   */
  milestoneProgressPercentage: number | null;

  // Relations
  items: PlanningItemDTO[];
  milestones: PlanningMilestoneDTO[];
  documents: PlanningDocumentDTO[];
}

/**
 * CreatePlanningDTO - Request payload for creating new planning
 * Contains only required fields for creation
 */
export interface CreatePlanningDTO {
  type: PlanningType;
  title: string;
  description?: string | null;
  area: string;
  coordinates?: Coordinates | null;
  estimatedUnits: number;
  estimatedBudget?: number | null;
  approvalLevel?: number;
  startDate?: string | null;
  targetCompletionDate?: string | null;
}

/**
 * UpdatePlanningDTO - Request payload for updating existing planning
 * All fields optional to support partial updates
 */
export interface UpdatePlanningDTO {
  title?: string;
  description?: string | null;
  area?: string;
  coordinates?: Coordinates | null;
  estimatedUnits?: number;
  estimatedBudget?: number | null;
  actualBudget?: number | null;
  progressPercentage?: number;
  startDate?: string | null;
  targetCompletionDate?: string | null;
}

/**
 * SubmitPlanningDTO - Request payload for submitting planning for approval
 */
export interface SubmitPlanningDTO {
  planningId: string;
}

/**
 * ApprovePlanningDTO - Request payload for approving planning
 */
export interface ApprovePlanningDTO {
  planningId: string;
  approvalNotes?: string | null;
}

/**
 * RejectPlanningDTO - Request payload for rejecting planning
 */
export interface RejectPlanningDTO {
  planningId: string;
  approvalNotes: string;
}
