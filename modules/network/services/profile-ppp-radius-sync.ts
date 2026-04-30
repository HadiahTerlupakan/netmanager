import { logger } from "@/lib/logger";
import type { ProfilePPPSchema } from "@/lib/validations/profileppp";
import type { RadiusRepository } from "../repositories/RadiusRepository";
import type { ProfilePPPRecord, SessionContext } from "./profile-ppp.types";

type RadiusModeResolver = () => Promise<{
  getConnectionMode(): Promise<string>;
}>;

export async function syncRadiusProfileOnCreate(input: {
  radiusRepository: RadiusRepository;
  getRadiusSyncService: RadiusModeResolver;
  session: SessionContext;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
}) {
  try {
    if (!(await isRadiusMode(input.getRadiusSyncService))) {
      return;
    }

    await input.radiusRepository.syncProfileToRadius(input.profilePPP.id);
    await syncNewRadiusIpPool(input);
  } catch (error) {
    logger.error("[API ProfilePPP] RADIUS sync error during creation:", error);
  }
}

export async function syncRadiusProfileOnUpdate(input: {
  radiusRepository: RadiusRepository;
  getRadiusSyncService: RadiusModeResolver;
  session: SessionContext;
  oldProfile: ProfilePPPRecord;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
}) {
  try {
    if (!(await isRadiusMode(input.getRadiusSyncService))) {
      return;
    }

    await input.radiusRepository.syncProfileToRadius(input.profilePPP.id);
    await clearOldRadiusIpPool(input);
    await syncNewRadiusIpPool(input);
  } catch (error) {
    logger.error("[API ProfilePPP] RADIUS sync error during update:", error);
  }
}

async function isRadiusMode(getRadiusSyncService: RadiusModeResolver) {
  const radiusSync = await getRadiusSyncService();
  return (await radiusSync.getConnectionMode()) === "RADIUS";
}

async function syncNewRadiusIpPool(input: {
  radiusRepository: RadiusRepository;
  session: SessionContext;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
}) {
  if (input.profilePPP.poolMode !== "RADIUS" || !input.data.ipRange) {
    return;
  }

  const tenantId = input.profilePPP.tenantId || input.session.user.tenantId;
  if (!tenantId) {
    return;
  }

  await input.radiusRepository.syncIpPoolToRadius(
    input.profilePPP.remoteAddress,
    input.data.ipRange,
    tenantId,
  );
}

async function clearOldRadiusIpPool(input: {
  radiusRepository: RadiusRepository;
  session: SessionContext;
  oldProfile: ProfilePPPRecord;
  profilePPP: ProfilePPPRecord;
}) {
  if (
    input.oldProfile.poolMode !== "RADIUS" ||
    !input.oldProfile.remoteAddress
  ) {
    return;
  }

  const mustClearOldPool =
    input.profilePPP.poolMode !== "RADIUS" ||
    input.oldProfile.remoteAddress !== input.profilePPP.remoteAddress;
  if (!mustClearOldPool) {
    return;
  }

  const tenantId = input.oldProfile.tenantId || input.session.user.tenantId;
  if (!tenantId) {
    return;
  }

  await input.radiusRepository.syncIpPoolToRadius(
    input.oldProfile.remoteAddress,
    "",
    tenantId,
  );
}
