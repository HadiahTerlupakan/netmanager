import { logger } from "@/lib/logger";
import type { RadiusRepository } from "../repositories/RadiusRepository";

type RadiusModeResolver = () => Promise<{
  getConnectionMode(): Promise<string>;
}>;

type HargaPaketSyncRecord = {
  id: string;
  name: string;
  profilePPPId: string;
  profilePPP?: {
    id: string;
    name: string;
    poolMode: string | null;
    mikroTikRouterId: string | null;
    mikroTikRouter?: unknown;
  };
};

type HargaPaketWithRouter = HargaPaketSyncRecord & {
  profilePPP: NonNullable<HargaPaketSyncRecord["profilePPP"]>;
};

const getRadiusSyncService: RadiusModeResolver = async () => {
  const { RadiusSyncService } = await import("./radius-sync-service");
  return new RadiusSyncService();
};

export async function syncRadiusPackage(params: {
  packageId: string;
  radiusRepository: Pick<RadiusRepository, "syncPackageToRadius">;
  errorMessage: string;
}): Promise<void> {
  try {
    if (!(await isRadiusMode(getRadiusSyncService))) {
      return;
    }

    await params.radiusRepository.syncPackageToRadius(params.packageId);
  } catch (error: unknown) {
    logger.error(params.errorMessage, error);
  }
}

export async function syncMikroTikRateLimit(
  hargaPaket: HargaPaketSyncRecord,
): Promise<void> {
  if (!hasAssignedMikroTikRouter(hargaPaket)) {
    return;
  }

  try {
    if (await shouldSkipMikroTikSync(hargaPaket)) {
      return;
    }

    const { getRateLimitFromBandwidth, updatePPPProfileInMikroTik } =
      await import("./mikrotik-ppp-profile");
    const rateLimit = await getRateLimitFromBandwidth(hargaPaket.profilePPP.id);

    if (!rateLimit) {
      return;
    }

    const updateResult = await updatePPPProfileInMikroTik(
      hargaPaket.profilePPP.mikroTikRouterId,
      hargaPaket.profilePPP.name,
      {
        rateLimit,
        skipPoolCheck: hargaPaket.profilePPP.poolMode === "RADIUS",
      },
    );

    if (!updateResult.success) {
      logger.error(
        "[HargaPaketService] Failed to update rate limit:",
        updateResult.error,
      );
    }
  } catch (error: unknown) {
    logger.error("[HargaPaketService] Error syncing MikroTik:", error);
  }
}

async function isRadiusMode(
  getRadiusSyncServiceInstance: RadiusModeResolver,
): Promise<boolean> {
  const radiusSync = await getRadiusSyncServiceInstance();
  return (await radiusSync.getConnectionMode()) === "RADIUS";
}

function hasAssignedMikroTikRouter(
  hargaPaket: HargaPaketSyncRecord,
): hargaPaket is HargaPaketWithRouter {
  return Boolean(
    hargaPaket.profilePPP?.mikroTikRouterId &&
    hargaPaket.profilePPP.mikroTikRouter,
  );
}

async function shouldSkipMikroTikSync(
  hargaPaket: HargaPaketWithRouter,
): Promise<boolean> {
  return (
    hargaPaket.profilePPP.poolMode === "RADIUS" &&
    (await isRadiusMode(getRadiusSyncService))
  );
}
