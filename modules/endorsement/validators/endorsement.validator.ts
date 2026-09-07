import { z } from "zod";
import {
  ENDORSEMENT_SOURCE_TYPES,
  SIGNER_STATUSES,
} from "../domain/entities/Endorsement";

/**
 * Validasi masukan surat pengesahan.
 *
 * Penanda tangan boleh internal (punya `userId`) maupun pihak luar (hanya nama
 * dan kontak), jadi kontak wajib ada minimal satu supaya link masih bisa
 * dikirim ke seseorang.
 */

const MAX_TITLE_LENGTH = 200;
const MAX_SIGNERS = 20;

export const endorsementSignerInputSchema = z
  .object({
    name: z.string().min(2).max(120),
    role: z.string().max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(6).max(20).optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((signer) => Boolean(signer.email || signer.phone || signer.userId), {
    message:
      "Penanda tangan butuh email, nomor telepon, atau akun pengguna agar link bisa dikirim",
  });

export const createEndorsementSchema = z.object({
  title: z.string().min(3).max(MAX_TITLE_LENGTH),
  description: z.string().max(2000).optional(),
  sourceType: z.enum(ENDORSEMENT_SOURCE_TYPES).default("UPLOAD"),
  sourceId: z.string().min(1).optional(),
  sourceFileKey: z.string().min(1),
  sourceFileName: z.string().min(1).max(255),
  sourceFileHash: z.string().regex(/^[a-f0-9]{64}$/, "Hash sha256 tidak valid"),
  expiresAt: z.coerce.date().optional(),
  signers: z.array(endorsementSignerInputSchema).min(1).max(MAX_SIGNERS),
});

export const updateEndorsementSchema = z.object({
  title: z.string().min(3).max(MAX_TITLE_LENGTH).optional(),
  description: z.string().max(2000).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const listEndorsementSchema = z.object({
  status: z.string().optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelEndorsementSchema = z.object({
  reason: z.string().min(3).max(500),
});

/**
 * Tanda tangan dikirim sebagai data URL PNG dari kanvas. Dibatasi supaya
 * goresan yang wajar tetap lolos sementara unggahan besar ditolak sebelum
 * menyentuh penyimpanan.
 */
const MAX_SIGNATURE_DATA_URL_LENGTH = 400_000;

export const signEndorsementSchema = z.object({
  signatureDataUrl: z
    .string()
    .max(MAX_SIGNATURE_DATA_URL_LENGTH)
    .regex(
      /^data:image\/png;base64,[A-Za-z0-9+/=]+$/,
      "Tanda tangan harus PNG",
    ),
});

export const declineEndorsementSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const signerStatusSchema = z.enum(SIGNER_STATUSES);
