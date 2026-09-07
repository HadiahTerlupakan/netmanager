import { logger } from "@/lib/logger";
import {
  createNotification,
  notifyNewPointClaim,
} from "@/modules/notification";
import type {
  CanvasingClaimSubmissionEntity,
  PointClaimEntity,
} from "../domain/entities/PointClaimEntity";

const POINT_CLAIM_SOURCE = "POINT_CLAIM" as const;
const NORMAL_PRIORITY = "NORMAL" as const;

export function notifySubmittedClaim(
  canvasing: CanvasingClaimSubmissionEntity,
  claim: PointClaimEntity,
): void {
  notifyNewPointClaim({
    claimId: claim.id,
    canvasingId: canvasing.id,
    customerName: canvasing.nama,
    salesId: canvasing.salesId,
    salesName: canvasing.userName || "Sales",
    pointValue: claim.pointValue,
    siteId: canvasing.userSiteId,
  }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
}

export function notifyApprovedClaim(claim: PointClaimEntity): void {
  createNotification({
    type: "ANNOUNCEMENT",
    priority: NORMAL_PRIORITY,
    title: "⭐ Claim Poin Disetujui",
    message: `Claim poin +${claim.pointValue} poin berhasil disetujui!`,
    link: `/admin/marketing/canvasing/${claim.canvasingId}`,
    userId: claim.salesId,
    sourceType: POINT_CLAIM_SOURCE,
    sourceId: claim.id,
  }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
}

export function notifyRejectedClaim(
  claim: PointClaimEntity,
  notes: string,
  sourceId: string,
): void {
  createNotification({
    type: "ANNOUNCEMENT",
    priority: NORMAL_PRIORITY,
    title: "❌ Claim Poin Ditolak",
    message: `Claim poin ditolak. Alasan: ${notes}`,
    link: `/admin/marketing/canvasing/${claim.canvasingId}`,
    userId: claim.salesId,
    sourceType: POINT_CLAIM_SOURCE,
    sourceId,
  }).catch((error) => logger.error("[PointClaim Notif] Error:", error));
}
