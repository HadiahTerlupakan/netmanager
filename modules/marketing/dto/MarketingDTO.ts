/**
 * Marketing DTOs (Data Transfer Objects)
 */

import type {
  CanvasingStatus,
  PointClaimStatus,
} from "../types/marketing.enums";

// ==================== Canvasing DTOs ====================

/**
 * DTO for canvasing list views
 */
export interface CanvasingListItemDTO {
  id: string;
  nama: string;
  noTelpon: string;
  alamat: string;
  paket: string;
  status: CanvasingStatus;
  salesName: string | null;
  createdAt: string;
}

/**
 * DTO for canvasing detail views
 */
export interface CanvasingDetailDTO {
  id: string;
  nama: string;
  noKtp: string;
  noTelpon: string;
  email: string | null;
  alamat: string;
  kabel: number;
  odp: string | null;
  paket: string;
  sn: string | null;
  latitude: number | null;
  longitude: number | null;
  foto: string | null;
  fotoKtp: string | null;
  status: CanvasingStatus;
  isLocked: boolean;
  salesId: string | null;
  createdAt: string;
  updatedAt: string;
  sales: {
    id: string;
    name: string | null;
  };
  approver: {
    id: string;
    name: string | null;
  } | null;
  approvedAt: string | null;
  workOrderId: string | null;
  pointClaims: PointClaimDTO | null;
}

// ==================== Point Claim DTOs ====================

/**
 * DTO for point claim
 */
export interface PointClaimDTO {
  id: string;
  canvasingId: string;
  salesId: string;
  salesName: string | null;
  buktiUrls: string[];
  keterangan: string | null;
  status: PointClaimStatus;
  points: number;
  createdAt: string;
  processedAt: string | null;
}

/**
 * DTO for point claim list
 */
export interface PointClaimListItemDTO {
  id: string;
  salesName: string | null;
  customerName: string;
  status: PointClaimStatus;
  points: number;
  createdAt: string;
}

// ==================== Loyalty Point DTOs ====================

/**
 * DTO for loyalty point balance
 */
export interface LoyaltyPointBalanceDTO {
  userId: string;
  userName: string | null;
  totalPoints: number;
  pendingPoints: number;
  redeemedPoints: number;
  availablePoints: number;
}

/**
 * DTO for point history
 */
export interface PointHistoryDTO {
  id: string;
  type: "EARN" | "REDEEM";
  points: number;
  description: string;
  createdAt: string;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating canvasing
 */
export interface CreateCanvasingDTO {
  nama: string;
  noKtp: string;
  noTelpon: string;
  email?: string;
  alamat: string;
  kabel: number;
  odp?: string;
  paket: string;
  latitude?: number;
  longitude?: number;
  foto?: string;
  fotoKtp?: string;
}

/**
 * DTO for claiming points
 */
export interface ClaimPointsDTO {
  canvasingId: string;
  buktiUrls: string[];
  keterangan?: string;
}
