import { logger } from "@/lib/logger";
import { PlayStoreReleaseRepository } from "../repositories/PlayStoreReleaseRepository";
import {
  isMobileVersionSupported,
  resolveMinimumMobileVersion,
  type MinimumMobileVersion,
  type ReportedMobileVersion,
} from "./mobile-version-policy";

/**
 * Dicek di setiap request mobile, jadi dibaca dari database paling sering
 * sekali per menit per pod. Perubahan dari admin atau sinkronisasi Play
 * berlaku paling lambat semenit kemudian.
 */
const CACHE_TTL_MS = 60 * 1000;

const repository = new PlayStoreReleaseRepository();
let cached: { value: MinimumMobileVersion | null; readAt: number } | null =
  null;
let lastKnown: MinimumMobileVersion | null = null;

/** Batas manual dari env, dipertahankan sebagai lantai di bawah rilis Play. */
function envFloor(): number {
  const value = Number(process.env.MOBILE_MIN_NATIVE_VERSION_CODE ?? "0");
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function withEnvFloor(
  minimum: MinimumMobileVersion | null,
): MinimumMobileVersion | null {
  const floor = envFloor();
  if (!minimum)
    return floor > 0 ? { versionCode: floor, versionName: null } : null;
  return floor > minimum.versionCode
    ? { ...minimum, versionCode: floor }
    : minimum;
}

/** Versi paling lama yang masih boleh memakai aplikasi mobile, atau null. */
export async function getMinimumMobileVersion(): Promise<MinimumMobileVersion | null> {
  if (cached && Date.now() - cached.readAt < CACHE_TTL_MS) return cached.value;
  try {
    const releases = await repository.findAll();
    const value = withEnvFloor(
      resolveMinimumMobileVersion(releases, new Date()),
    );
    cached = { value, readAt: Date.now() };
    lastKnown = value;
    return value;
  } catch (error) {
    // Gagal membaca tidak boleh melonggarkan batas yang sudah berlaku.
    logger.warn("[MobileVersionGate] Gagal membaca rilis Play Store", {
      error,
    });
    return lastKnown ?? withEnvFloor(null);
  }
}

export async function evaluateMobileVersion(reported: ReportedMobileVersion) {
  const minimum = await getMinimumMobileVersion();
  return {
    isSupported: isMobileVersionSupported(reported, minimum),
    minimum,
  };
}

/** Kosongkan cache; dipakai sesudah admin atau sinkronisasi mengubah rilis. */
export function resetMinimumMobileVersionCache(
  options: { keepLastKnown?: boolean } = {},
) {
  cached = null;
  if (!options.keepLastKnown) lastKnown = null;
}

/** Rilis produksi terbaru (yang tidak dibatalkan) dan versi minimum saat ini. */
export async function getPlayStoreStatus() {
  const [releases, minimum] = await Promise.all([
    repository.findAll(),
    getMinimumMobileVersion(),
  ]);
  return {
    latest: releases.find((release) => !release.cancelledAt) ?? null,
    minimum,
  };
}
