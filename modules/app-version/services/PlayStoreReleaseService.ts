import {
  fetchProductionReleases,
  readServiceAccount,
  type PlayProductionRelease,
  type ServiceAccount,
} from "@/lib/google-play/production-track";
import { PlayStoreReleaseRepository } from "../repositories/PlayStoreReleaseRepository";
import { resetMinimumMobileVersionCache } from "./MobileVersionGate";
import {
  enforcementStartsAt,
  resolveMinimumMobileVersion,
  type MinimumMobileVersion,
} from "./mobile-version-policy";

/**
 * REQUIRED: versi minimum saat ini. GRACE: lebih baru, belum diwajibkan.
 * LOCKED_OUT: lebih lama dari versi minimum, sudah ditolak. CANCELLED:
 * dibatalkan admin, tidak dipakai sebagai batas.
 */
export type PlayStoreReleaseStatus =
  | "REQUIRED"
  | "GRACE"
  | "LOCKED_OUT"
  | "CANCELLED";

interface Dependencies {
  repository: Pick<
    PlayStoreReleaseRepository,
    "findAll" | "recordSeen" | "setCancelled"
  >;
  readAccount: () => ServiceAccount | null;
  fetchReleases: (account: ServiceAccount) => Promise<PlayProductionRelease[]>;
  onChange: () => void;
  now: () => Date;
}

const defaultDependencies = (): Dependencies => ({
  repository: new PlayStoreReleaseRepository(),
  readAccount: () =>
    readServiceAccount(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),
  fetchReleases: (account) => fetchProductionReleases(account),
  onChange: () => resetMinimumMobileVersionCache({ keepLastKnown: true }),
  now: () => new Date(),
});

/** Sinkronisasi rilis produksi Google Play dan pengelolaannya dari admin. */
export class PlayStoreReleaseService {
  private readonly deps: Dependencies;

  constructor(deps: Partial<Dependencies> = {}) {
    this.deps = { ...defaultDependencies(), ...deps };
  }

  /** Catat rilis produksi yang baru terlihat. Tanpa kredensial: tidak apa-apa. */
  async sync(): Promise<{ configured: boolean; recorded: number[] }> {
    const account = this.deps.readAccount();
    if (!account) return { configured: false, recorded: [] };

    const releases = await this.deps.fetchReleases(account);
    const recorded: number[] = [];
    for (const release of releases) {
      if (await this.deps.repository.recordSeen(release)) {
        recorded.push(release.versionCode);
      }
    }
    if (recorded.length > 0) this.deps.onChange();
    return { configured: true, recorded };
  }

  async overview() {
    const releases = await this.deps.repository.findAll();
    const minimum = resolveMinimumMobileVersion(releases, this.deps.now());
    return {
      credentialConfigured: this.deps.readAccount() !== null,
      minimum,
      releases: releases.map((release) => ({
        ...release,
        enforcedFrom: enforcementStartsAt(release),
        status: statusOf(release, minimum),
      })),
    };
  }

  /** Batalkan (atau pulihkan) penguncian berdasarkan satu rilis. */
  async setCancelled(
    versionCode: number,
    cancelled: boolean,
    userId: string,
  ): Promise<boolean> {
    const updated = await this.deps.repository.setCancelled({
      versionCode,
      cancelledAt: cancelled ? this.deps.now() : null,
      cancelledById: cancelled ? userId : null,
    });
    if (updated) this.deps.onChange();
    return updated;
  }
}

function statusOf(
  release: { versionCode: number; cancelledAt: Date | null },
  minimum: MinimumMobileVersion | null,
): PlayStoreReleaseStatus {
  if (release.cancelledAt) return "CANCELLED";
  if (!minimum || release.versionCode > minimum.versionCode) return "GRACE";
  return release.versionCode === minimum.versionCode
    ? "REQUIRED"
    : "LOCKED_OUT";
}
