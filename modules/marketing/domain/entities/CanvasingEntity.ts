export type CanvasingStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SiteReferenceEntity {
  id: string;
  name: string;
}

export interface UserReferenceEntity {
  id: string;
  name: string | null;
  email: string | null;
  siteId: string | null;
  site?: SiteReferenceEntity | null;
}

export interface ApproverReferenceEntity {
  id: string;
  name: string | null;
}

export interface MitraReferenceEntity {
  id: string;
  name: string | null;
  email: string | null;
  mitraType: string | null;
  siteId: string | null;
  site?: SiteReferenceEntity | null;
}

export interface WorkOrderReferenceEntity {
  id: string;
  workOrderNumber: string;
  status: string;
}

export interface PointClaimReferenceEntity {
  id: string;
  status: string;
  buktiUrls: string[];
  keterangan: string | null;
  pointValue: number;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  createdAt: Date;
}

export interface CanvasingEntity {
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
  mitraId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  workOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: UserReferenceEntity | null;
  approver?: ApproverReferenceEntity | null;
  mitra?: MitraReferenceEntity | null;
  workOrder?: WorkOrderReferenceEntity | null;
  pointClaim?: PointClaimReferenceEntity | null;
}

export interface CanvasingListSummaryEntity {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pendingClaims: number;
}

export interface CanvasingCompletionSummaryEntity {
  total: number;
  woStartedToday: number;
  completedToday: number;
  completedWeek: number;
  completedMonth: number;
  pending: number;
  approved: number;
  rejected: number;
}
