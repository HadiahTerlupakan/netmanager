export type PointClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PointClaimSalesEntity {
  id: string;
  name: string | null;
  email: string | null;
}

export interface PointClaimReviewerEntity {
  id: string;
  name: string | null;
}

export interface PointClaimCanvasingEntity {
  id: string;
  nama: string;
  alamat: string;
  paket: string;
  workOrderNumber: string | null;
  workOrderStatus: string | null;
}

export interface PointClaimEntity {
  id: string;
  canvasingId: string;
  salesId: string;
  buktiUrls: string[];
  buktiMetadata: Record<string, unknown> | null;
  keterangan: string | null;
  pointValue: number;
  status: PointClaimStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  tenantId: string | null;
  isCashedOut?: boolean;
  createdAt: Date;
  updatedAt: Date;
  sales?: PointClaimSalesEntity | null;
  reviewedBy?: PointClaimReviewerEntity | null;
  canvasing?: PointClaimCanvasingEntity | null;
}

export interface PointSummaryEntity {
  totalPoints: number;
  approvedClaims: number;
  pendingClaims: number;
  woInProgressPoints: number;
  woCompletedPoints: number;
  claimPoints: number;
}

export interface PointClaimDashboardSummaryEntity {
  totalPoints: number;
  approvedClaims: number;
  pendingClaims: number;
}

export interface CanvasingClaimSubmissionEntity {
  id: string;
  nama: string;
  salesId: string;
  isLocked: boolean;
  workOrderStatus: string | null;
  hasPointClaim: boolean;
  userName: string | null;
  userSiteId: string | null;
}
