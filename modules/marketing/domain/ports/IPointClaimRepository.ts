import type {
  CanvasingClaimSubmissionEntity,
  PointClaimDashboardSummaryEntity,
  PointClaimEntity,
  PointSummaryEntity,
} from "../entities/PointClaimEntity";

export interface CreatePointClaimInput {
  canvasingId: string;
  salesId: string;
  buktiUrls: string[];
  buktiMetadata?: Record<string, unknown>;
  keterangan?: string;
}

export interface UpdatePointClaimInput {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  reviewedById?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  isCashedOut?: boolean;
}

export interface PointClaimFilters {
  status?: string;
  salesId?: string;
  tenantId?: string;
}

export interface IPointClaimRepository {
  /** Create a new point claim and lock its canvasing atomically. */
  createWithCanvasingLock(
    data: CreatePointClaimInput,
  ): Promise<PointClaimEntity>;

  /** Create a new point claim and return its domain entity. */
  create(data: CreatePointClaimInput): Promise<PointClaimEntity>;

  /** Find canvasing state needed before point claim submission. */
  findCanvasingClaimSubmission(
    canvasingId: string,
  ): Promise<CanvasingClaimSubmissionEntity | null>;

  /** Update canvasing lock state. */
  updateCanvasingLock(canvasingId: string, isLocked: boolean): Promise<void>;

  /** Find a point claim by id. */
  findById(id: string): Promise<PointClaimEntity | null>;

  /** Find a point claim by canvasing id. */
  findByCanvasingId(canvasingId: string): Promise<PointClaimEntity | null>;

  /** Find all point claims using optional filters. */
  findAll(filters?: PointClaimFilters): Promise<PointClaimEntity[]>;

  /** Return point claim dashboard summary. */
  getDashboardSummary(
    tenantId?: string,
  ): Promise<PointClaimDashboardSummaryEntity>;

  /** Update a point claim and return the updated entity. */
  update(id: string, data: UpdatePointClaimInput): Promise<PointClaimEntity>;

  /** Delete a point claim by id. */
  delete(id: string): Promise<void>;

  /** Mark all approved & not-cashed claims for the sales user as cashed out. */
  markClaimsAsCashedOut(claimIds: string[]): Promise<void>;

  /** Reject a pending point claim and unlock the canvasing atomically. */
  rejectAndUnlock(input: {
    id: string;
    reviewerId: string;
    reviewNotes: string;
    canvasingId: string;
  }): Promise<PointClaimEntity>;

  /** Delete a pending claim and unlock its canvasing atomically. */
  deleteAndUnlock(input: { id: string; canvasingId: string }): Promise<void>;

  /** Return point summary for a sales user. */
  getPointSummaryBySales(salesId: string): Promise<PointSummaryEntity>;
}
