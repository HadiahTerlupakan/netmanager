import {
  canAccessDocument,
  canSign,
  countSigned,
} from "../domain/endorsement-rules";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "../domain/entities/Endorsement";

/**
 * Bentuk surat untuk kotak masuk penanda tangan internal di aplikasi mobile.
 *
 * Kontak penanda tangan lain sengaja tidak ikut — penanda tangan cukup tahu
 * siapa saja dan sejauh mana kemajuannya.
 */

export interface InboxSignerDto {
  id: string;
  name: string;
  role: string | null;
  status: string;
  signedAt: string | null;
  isMe: boolean;
}

export interface InboxItemDto {
  id: string;
  number: string;
  title: string;
  status: string;
  mySignerStatus: string;
  canSign: boolean;
  signerCount: number;
  signedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface InboxDetailDto extends InboxItemDto {
  /** Dokumen masih boleh dibuka (sama dengan aturan endpoint berkas). */
  canViewDocument: boolean;
  description: string | null;
  sourceFileName: string;
  hasSignedFile: boolean;
  cancelReason: string | null;
  signers: InboxSignerDto[];
}

/** Ringkasan satu surat dari sudut pandang penanda tangan `me`. */
export function toInboxItem(
  endorsement: EndorsementEntity,
  me: EndorsementSignerEntity,
): InboxItemDto {
  return {
    id: endorsement.id,
    number: endorsement.number,
    title: endorsement.title,
    status: endorsement.status,
    mySignerStatus: me.status,
    canSign: canSign(endorsement, me),
    signerCount: endorsement.signers.length,
    signedCount: countSigned(endorsement.signers),
    expiresAt: endorsement.expiresAt?.toISOString() ?? null,
    createdAt: endorsement.createdAt.toISOString(),
  };
}

/** Detail surat dari sudut pandang penanda tangan `me`. */
export function toInboxDetail(
  endorsement: EndorsementEntity,
  me: EndorsementSignerEntity,
): InboxDetailDto {
  return {
    ...toInboxItem(endorsement, me),
    canViewDocument: canAccessDocument(endorsement),
    description: endorsement.description,
    sourceFileName: endorsement.sourceFileName,
    hasSignedFile: Boolean(endorsement.signedFileKey),
    cancelReason: endorsement.cancelReason,
    signers: endorsement.signers.map((signer) => ({
      id: signer.id,
      name: signer.name,
      role: signer.role,
      status: signer.status,
      signedAt: signer.signedAt?.toISOString() ?? null,
      isMe: signer.id === me.id,
    })),
  };
}
