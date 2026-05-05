import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logger, logActivitySafe } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { ServiceFailure } from "./MobileMitraRouteService.types";

const VERIFIED_MESSAGE = "Verifikasi wajah berhasil";
const UPLOAD_ROOT_SEGMENTS = ["public", "uploads", "mitra"] as const;
const FACE_VERIFICATION_PREFIX = "face_verification";
const FACE_PHOTO_EXTENSION = "jpg";
const FACE_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const FACE_PHOTO_MAX_WIDTH = 1600;
const FACE_PHOTO_QUALITY = 85;
const WITHDRAW_METHODS = ["TRANSFER", "CASH"] as const;

export interface MobileMitraFaceVerificationSession {
  id: string;
  tenantId?: string | null;
}

export interface FaceVerificationFile {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
  type?: string;
}

interface FeePelangganStatsRepository {
  getFeePelangganStats(input: {
    mitraId: string;
    ownerNames: string[];
    feeRate: number;
    monthStart: Date;
    today: Date;
  }): Promise<{
    activeCustomers: number;
    totalFeePelanggan: number;
    remainingFeePelanggan: number;
    unpaidCustomersCount: number;
  }>;
}

/** Return the fixed mobile face verification success message. */
export function getVerifiedFaceMessage() {
  return VERIFIED_MESSAGE;
}

/** Build fee pelanggan stats for the mobile mitra dashboard. */
export async function getFeePelangganStatsForMitra(
  repository: FeePelangganStatsRepository,
  mitra: {
    id: string;
    mitraType: string;
    enableFeePelanggan: boolean;
    mitraRateFeePelanggan: number | null;
    mixradiusOwnerNames: string[];
  },
) {
  if (mitra.mitraType !== "MITRA_SALES" || !mitra.enableFeePelanggan) {
    return buildEmptyFeeStats();
  }

  try {
    const today = createTodayStart();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return await repository.getFeePelangganStats({
      mitraId: mitra.id,
      ownerNames: mitra.mixradiusOwnerNames || [],
      feeRate: mitra.mitraRateFeePelanggan || 0,
      monthStart,
      today,
    });
  } catch (error) {
    logger.error(
      "[MobileMitraRouteService] Error getting fee pelanggan stats",
      error as Error,
    );
    return buildEmptyFeeStats();
  }
}

/** Save a normalized mobile face verification image under the mitra uploads folder. */
export async function saveFaceVerificationPhoto(
  mitraId: string,
  photo: FaceVerificationFile,
): Promise<string> {
  validateFaceVerificationFile(photo);
  const uploadDirectory = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ...UPLOAD_ROOT_SEGMENTS,
  );
  fs.mkdirSync(uploadDirectory, { recursive: true });

  const fileBuffer = Buffer.from(await photo.arrayBuffer());
  const normalizedBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({ width: FACE_PHOTO_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: FACE_PHOTO_QUALITY })
    .toBuffer();
  const filename = `${FACE_VERIFICATION_PREFIX}_${mitraId}_${Date.now()}.${FACE_PHOTO_EXTENSION}`;
  const filePath = path.join(uploadDirectory, filename);
  fs.writeFileSync(filePath, normalizedBuffer);
  return `/uploads/mitra/${filename}`;
}

/** Record the audit trail for a successful mobile face verification. */
export function logMobileFaceVerification(
  session: MobileMitraFaceVerificationSession,
  photoUrl: string,
) {
  logActivitySafe({
    action: "UPDATE",
    subject: "Face Verification",
    userId: null,
    tenantId: session.tenantId ?? undefined,
    details: {
      mitraId: session.id,
      action: "FACE_VERIFY_MOBILE",
      photoUrl,
      status: "SUCCESS",
    },
  });
}

/** Build consistent mobile service failure result. */
export function buildFailureResult(
  error: string,
  status: number,
): ServiceFailure {
  return { success: false, error, status };
}

/** Validate mobile withdraw amount before service call. */
export function getWithdrawAmountError(amount: number) {
  if (!amount || amount <= 0) {
    return "Jumlah penarikan harus lebih dari 0";
  }

  return null;
}

/** Validate supported mobile withdraw methods. */
export function getWithdrawMethodError(method: "TRANSFER" | "CASH") {
  if (WITHDRAW_METHODS.includes(method)) {
    return null;
  }

  return "Metode penarikan tidak valid";
}

function validateFaceVerificationFile(photo: FaceVerificationFile) {
  if (photo.type && FACE_PHOTO_MIME_TYPES.has(photo.type)) {
    return;
  }

  throw new Error("Format foto tidak didukung");
}

function buildEmptyFeeStats() {
  return {
    activeCustomers: 0,
    totalFeePelanggan: 0,
    remainingFeePelanggan: 0,
    unpaidCustomersCount: 0,
  };
}

function createTodayStart() {
  const today = new Date();
  today.setTime(toStartOfDay(today).getTime());
  return today;
}
