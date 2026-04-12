import type { PointClaim, PointClaimStatus } from "@prisma/client";

export interface CreatePointClaimInput {
  canvasingId: string;
  salesId: string;
  buktiUrls: string[];
  buktiMetadata?: Record<string, unknown>;
  keterangan?: string;
}

export interface UpdatePointClaimInput {
  status?: PointClaimStatus;
  reviewedById?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface PointClaimWithRelations extends PointClaim {
  canvasing: {
    id: string;
    nama: string;
    alamat: string;
    paket: string;
    workOrder?: {
      workOrderNumber: string;
      status: string;
    } | null;
  };
  sales: {
    id: string;
    name: string | null;
    email: string;
  };
  reviewedBy?: {
    id: string;
    name: string | null;
  } | null;
}

export interface PointSummary {
  totalPoints: number;
  approvedClaims: number;
  pendingClaims: number;
  woInProgressPoints: number;
  woCompletedPoints: number;
  claimPoints: number;
}

export type PointClaimDashboardSummary = Pick<
  PointSummary,
  "totalPoints" | "approvedClaims" | "pendingClaims"
>;

export interface IPointClaimRepository {
  create(data: CreatePointClaimInput): Promise<PointClaim>;
  findById(id: string): Promise<PointClaimWithRelations | null>;
  findByCanvasingId(canvasingId: string): Promise<PointClaim | null>;
  findAll(filters?: {
    status?: PointClaimStatus;
    salesId?: string;
    tenantId?: string;
  }): Promise<PointClaimWithRelations[]>;
  getDashboardSummary(tenantId?: string): Promise<PointClaimDashboardSummary>;
  update(id: string, data: UpdatePointClaimInput): Promise<PointClaim>;
  delete(id: string): Promise<void>;
  getPointSummaryBySales(salesId: string): Promise<PointSummary>;
}
