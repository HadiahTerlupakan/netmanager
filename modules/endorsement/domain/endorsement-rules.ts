import type {
  EndorsementEntity,
  EndorsementSignerEntity,
  EndorsementStatus,
} from "./entities/Endorsement";

/**
 * Aturan bisnis surat pengesahan — fungsi murni, tanpa I/O.
 *
 * Ditaruh terpisah dari service supaya bisa diuji tanpa database dan supaya
 * satu-satunya definisi "kapan surat sah" tidak tersebar di beberapa tempat.
 */

/** Status yang berarti surat masih menunggu tanda tangan. */
const OPEN_STATUSES: EndorsementStatus[] = ["SENT"];

/** Apakah semua penanda tangan sudah membubuhkan tanda tangan? */
export function isFullySigned(signers: EndorsementSignerEntity[]): boolean {
  if (signers.length === 0) return false;

  return signers.every((signer) => signer.status === "SIGNED");
}

/** Apakah ada pihak yang menolak? Satu penolakan menggugurkan surat. */
export function hasDecline(signers: EndorsementSignerEntity[]): boolean {
  return signers.some((signer) => signer.status === "DECLINED");
}

/** Sudah lewat masa berlaku? */
export function isExpired(
  endorsement: Pick<EndorsementEntity, "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (!endorsement.expiresAt) return false;

  return endorsement.expiresAt.getTime() < now.getTime();
}

/**
 * Apakah penanda tangan ini masih boleh menandatangani?
 *
 * Urutannya paralel: siapa pun boleh duluan. Yang menghalangi hanya status
 * surat, masa berlaku, dan tanda tangan yang sudah terlanjur dibubuhkan.
 */
export function canSign(
  endorsement: Pick<EndorsementEntity, "status" | "expiresAt">,
  signer: Pick<EndorsementSignerEntity, "status">,
  now: Date = new Date(),
): boolean {
  if (!OPEN_STATUSES.includes(endorsement.status)) return false;
  if (isExpired(endorsement, now)) return false;

  return signer.status === "PENDING" || signer.status === "VIEWED";
}

/** Status surat setelah satu perubahan pada daftar penanda tangan. */
export function resolveEndorsementStatus(
  current: EndorsementStatus,
  signers: EndorsementSignerEntity[],
): EndorsementStatus {
  if (current !== "SENT") return current;
  if (hasDecline(signers)) return "CANCELLED";
  if (isFullySigned(signers)) return "COMPLETED";

  return current;
}

/** Berapa banyak yang sudah menandatangani, untuk ditampilkan di daftar. */
export function countSigned(signers: EndorsementSignerEntity[]): number {
  return signers.filter((signer) => signer.status === "SIGNED").length;
}
