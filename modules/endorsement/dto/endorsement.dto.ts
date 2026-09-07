import { countSigned } from "../domain/endorsement-rules";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "../domain/entities/Endorsement";

/**
 * Bentuk data yang dikirim ke klien.
 *
 * Kunci objek penyimpanan dan sidik jari token tidak pernah ikut: berkas hanya
 * boleh diambil lewat rute server yang memeriksa hak akses.
 */

export interface EndorsementSignerDto {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}

export interface EndorsementListItemDto {
  id: string;
  number: string;
  title: string;
  status: string;
  signerCount: number;
  signedCount: number;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface EndorsementDetailDto extends EndorsementListItemDto {
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceFileName: string;
  sourceFileHash: string;
  signedFileHash: string | null;
  hasSignedFile: boolean;
  cancelReason: string | null;
  signers: EndorsementSignerDto[];
}

export function toSignerDto(
  signer: EndorsementSignerEntity,
): EndorsementSignerDto {
  return {
    id: signer.id,
    name: signer.name,
    role: signer.role,
    email: signer.email,
    phone: signer.phone,
    status: signer.status,
    signedAt: signer.signedAt?.toISOString() ?? null,
    declinedAt: signer.declinedAt?.toISOString() ?? null,
    declineReason: signer.declineReason,
  };
}

export function toEndorsementListItem(
  endorsement: EndorsementEntity,
): EndorsementListItemDto {
  return {
    id: endorsement.id,
    number: endorsement.number,
    title: endorsement.title,
    status: endorsement.status,
    signerCount: endorsement.signers.length,
    signedCount: countSigned(endorsement.signers),
    expiresAt: endorsement.expiresAt?.toISOString() ?? null,
    completedAt: endorsement.completedAt?.toISOString() ?? null,
    createdAt: endorsement.createdAt.toISOString(),
  };
}

export function toEndorsementDetail(
  endorsement: EndorsementEntity,
): EndorsementDetailDto {
  return {
    ...toEndorsementListItem(endorsement),
    description: endorsement.description,
    sourceType: endorsement.sourceType,
    sourceId: endorsement.sourceId,
    sourceFileName: endorsement.sourceFileName,
    sourceFileHash: endorsement.sourceFileHash,
    signedFileHash: endorsement.signedFileHash,
    hasSignedFile: Boolean(endorsement.signedFileKey),
    cancelReason: endorsement.cancelReason,
    signers: endorsement.signers.map(toSignerDto),
  };
}
