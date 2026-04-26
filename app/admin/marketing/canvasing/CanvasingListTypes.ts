export interface PointClaim {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  buktiUrls: string[];
  keterangan?: string;
  pointValue: number;
  reviewNotes?: string;
  createdAt: string;
}

export interface CanvasingItem {
  id: string;
  nama: string;
  paket: string;
  alamat: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  sales?: { name: string } | null;
  user?: { name: string; email: string } | null;
  createdAt: string;
  pointClaims?: PointClaim[] | PointClaim | null;
}

export type CanvasingStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export interface CanvasingSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pendingClaims: number;
}

export interface FetchQueryState {
  page: number;
  search: string;
  siteId?: string;
  statusFilter: CanvasingStatusFilter;
}

export interface ClaimModalState {
  open: boolean;
  item: CanvasingItem | null;
  processing: boolean;
}

export const DEFAULT_SUMMARY: CanvasingSummary = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  pendingClaims: 0,
};

export const SEARCH_INPUT_LABEL = "Cari canvasing berdasarkan nama atau alamat";
export const CLAIM_MODAL_TITLE_ID = "claim-modal-title";
export const ZOOM_MODAL_TITLE_ID = "zoom-image-modal-title";

function getPointClaims(item: CanvasingItem): PointClaim[] {
  if (!item.pointClaims) {
    return [];
  }

  return Array.isArray(item.pointClaims)
    ? item.pointClaims
    : [item.pointClaims];
}

/** Return pending point claim for review actions. */
export function getPendingClaim(item: CanvasingItem) {
  return getPointClaims(item).find((claim) => claim.status === "PENDING");
}

/** Return approved point claim for claimed badge. */
export function getApprovedClaim(item: CanvasingItem) {
  return getPointClaims(item).find((claim) => claim.status === "APPROVED");
}
