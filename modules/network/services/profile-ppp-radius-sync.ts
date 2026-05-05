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

function resolveRadiusTenantId(
  profileTenantId: string | null,
  session: SessionContext,
) {
  return profileTenantId || session.user.tenantId;
}

function getRadiusPoolTenantId(
  profileTenantId: string | null,
  session: SessionContext,
) {
  return resolveRadiusTenantId(profileTenantId, session);
}

async function syncRadiusIpPool(input: {
  radiusRepository: RadiusRepository;
  remoteAddress: string;
  ipRange: string;
  tenantId: string | null;
}) {
  if (!input.tenantId) {
    return;
  }

  await input.radiusRepository.syncIpPoolToRadius(
    input.remoteAddress,
    input.ipRange,
    input.tenantId,
  );
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

  await syncRadiusIpPool({
    radiusRepository: input.radiusRepository,
    remoteAddress: input.profilePPP.remoteAddress,
    ipRange: input.data.ipRange,
    tenantId: getRadiusPoolTenantId(input.profilePPP.tenantId, input.session),
  });
}

function shouldClearOldRadiusPool(
  oldProfile: ProfilePPPRecord,
  profilePPP: ProfilePPPRecord,
) {
  return (
    oldProfile.poolMode === "RADIUS" &&
    Boolean(oldProfile.remoteAddress) &&
    (profilePPP.poolMode !== "RADIUS" ||
      oldProfile.remoteAddress !== profilePPP.remoteAddress)
  );
}

async function clearOldRadiusIpPool(input: {
  radiusRepository: RadiusRepository;
  session: SessionContext;
  oldProfile: ProfilePPPRecord;
  profilePPP: ProfilePPPRecord;
}) {
  if (!shouldClearOldRadiusPool(input.oldProfile, input.profilePPP)) {
    return;
  }

  await syncRadiusIpPool({
    radiusRepository: input.radiusRepository,
    remoteAddress: input.oldProfile.remoteAddress,
    ipRange: "",
    tenantId: getRadiusPoolTenantId(input.oldProfile.tenantId, input.session),
  });
}
