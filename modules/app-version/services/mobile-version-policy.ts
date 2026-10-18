/**
 * Rilis produksi Play Store baru diwajibkan dua hari sesudah pertama terlihat:
 * selama itu Google masih me-review-nya dan Play Store masih membagikan versi
 * sebelumnya, jadi mewajibkannya lebih cepat mengunci karyawan tanpa jalan
 * untuk update.
 */
export const ENFORCEMENT_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

export interface ProductionRelease {
  versionCode: number;
  versionName: string | null;
  firstSeenAt: Date;
  cancelledAt: Date | null;
  /** Diisi admin bila rilis sudah disetujui Google dan tak perlu menunggu. */
  enforcedFrom?: Date | null;
}

export interface MinimumMobileVersion {
  versionCode: number;
  versionName: string | null;
}

export interface ReportedMobileVersion {
  versionCode: number;
  versionName: string | null | undefined;
}

/** Saat sebuah rilis mulai diwajibkan. */
export function enforcementStartsAt(release: {
  firstSeenAt: Date;
  enforcedFrom?: Date | null;
}): Date {
  return (
    release.enforcedFrom ??
    new Date(release.firstSeenAt.getTime() + ENFORCEMENT_GRACE_MS)
  );
}

/**
 * Versi paling lama yang masih boleh memakai aplikasi: rilis produksi terbaru,
 * atau rilis sebelumnya selama yang terbaru masih dalam masa tenggang. Rilis
 * yang dibatalkan admin dilewati. Null berarti belum ada yang dikunci.
 */
export function resolveMinimumMobileVersion(
  releases: ProductionRelease[],
  now: Date,
): MinimumMobileVersion | null {
  const [latest, previous] = releases
    .filter((release) => !release.cancelledAt)
    .sort((a, b) => b.versionCode - a.versionCode);
  if (!latest) return null;

  const required =
    now >= enforcementStartsAt(latest) ? latest : (previous ?? null);
  return required
    ? { versionCode: required.versionCode, versionName: required.versionName }
    : null;
}

/**
 * Nomor build dan nomor versi sama-sama diperiksa: APK lama di luar Play
 * Store bisa membawa nomor build lebih besar dari rilis terbaru (1.0.0 build
 * 53 vs 1.0.9 build 49). Aplikasi yang tidak melaporkan nama versi hanya
 * dinilai dari nomor build-nya.
 */
export function isMobileVersionSupported(
  reported: ReportedMobileVersion,
  minimum: MinimumMobileVersion | null,
): boolean {
  if (!minimum) return true;
  if (reported.versionCode < minimum.versionCode) return false;
  if (!minimum.versionName || !reported.versionName) return true;
  return compareVersionNames(reported.versionName, minimum.versionName) >= 0;
}

function compareVersionNames(a: string, b: string): number {
  const partsA = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const partsB = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
