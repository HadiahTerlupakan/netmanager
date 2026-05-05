import { logger } from "@/lib/logger";
import type { ProfilePPPSchema } from "@/lib/validations/profileppp";

import {
  createPPPProfileInMikroTik,
  getRateLimitFromBandwidth,
  updatePPPProfileInMikroTik,
} from "./mikrotik-ppp-profile";
import type {
  ProfilePPPRecord,
  ProfilePPPRepository,
} from "./profile-ppp.types";

type RadiusModeResolver = () => Promise<{
  getConnectionMode(): Promise<string>;
}>;

async function isRadiusConnectionMode(
  getRadiusSyncService: RadiusModeResolver,
) {
  const radiusSync = await getRadiusSyncService();
  return (await radiusSync.getConnectionMode()) === "RADIUS";
}

async function runMikroTikProfileSync(input: {
  getRadiusSyncService: RadiusModeResolver;
  syncRadius: () => Promise<void>;
  syncMikroTik: () => Promise<void>;
  errorMessage: string;
}) {
  try {
    if (await isRadiusConnectionMode(input.getRadiusSyncService)) {
      await input.syncRadius();
      return;
    }

    await input.syncMikroTik();
  } catch (syncError) {
    logger.error(input.errorMessage, syncError);
  }
}

/** Sinkronkan profile baru ke router aktif atau broadcast RADIUS mode. */
export async function syncMikroTikProfileOnCreate(input: {
  repository: ProfilePPPRepository;
  getRadiusSyncService: RadiusModeResolver;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
  bandwidthId?: string | null;
}) {
  await runMikroTikProfileSync({
    getRadiusSyncService: input.getRadiusSyncService,
    syncRadius: () =>
      broadcastProfileCreate(input.repository, input.profilePPP, input.data),
    syncMikroTik: () =>
      createProfileOnAssignedRouter(
        input.profilePPP,
        input.data,
        input.bandwidthId,
      ),
    errorMessage:
      "[API ProfilePPP] Error during MikroTik profile broadcast (POST):",
  });
}

function getProfileUpdateSyncHandlers(input: {
  repository: ProfilePPPRepository;
  oldProfile: ProfilePPPRecord;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
  bandwidthId?: string | null;
}) {
  return {
    syncRadius: () =>
      broadcastProfileUpdate(
        input.repository,
        input.oldProfile,
        input.profilePPP,
        input.data,
      ),
    syncMikroTik: () =>
      updateProfileOnAssignedRouter(
        input.oldProfile,
        input.profilePPP,
        input.data,
        input.bandwidthId,
      ),
  };
}

/** Sinkronkan perubahan profile ke router aktif atau broadcast RADIUS mode. */
export async function syncMikroTikProfileOnUpdate(input: {
  repository: ProfilePPPRepository;
  getRadiusSyncService: RadiusModeResolver;
  oldProfile: ProfilePPPRecord;
  profilePPP: ProfilePPPRecord;
  data: ProfilePPPSchema;
  bandwidthId?: string | null;
}) {
  const handlers = getProfileUpdateSyncHandlers(input);
  await runMikroTikProfileSync({
    getRadiusSyncService: input.getRadiusSyncService,
    ...handlers,
    errorMessage: "[API ProfilePPP] Error during MikroTik profile broadcast:",
  });
}

async function broadcastProfileCreate(
  repository: ProfilePPPRepository,
  profilePPP: ProfilePPPRecord,
  data: ProfilePPPSchema,
) {
  const activeRouters = await repository.findRoutersForProfileBroadcast({
    tenantId: profilePPP.tenantId,
    siteId: profilePPP.siteId,
  });

  for (const router of activeRouters) {
    try {
      await createPPPProfileInMikroTik(
        router.id,
        buildBroadcastProfilePayload(data),
      );
    } catch (routerErr) {
      logger.error(
        `[API ProfilePPP] Failed to create profile in router ${router.name}:`,
        routerErr,
      );
    }
  }
}

async function broadcastProfileUpdate(
  repository: ProfilePPPRepository,
  oldProfile: ProfilePPPRecord,
  profilePPP: ProfilePPPRecord,
  data: ProfilePPPSchema,
) {
  const activeRouters = await repository.findRoutersForProfileBroadcast({
    tenantId: profilePPP.tenantId,
    siteId: profilePPP.siteId,
  });

  for (const router of activeRouters) {
    try {
      await updatePPPProfileInMikroTik(
        router.id,
        oldProfile.name,
        buildBroadcastProfilePayload(data),
      );
    } catch (routerErr) {
      logger.error(
        `[API ProfilePPP] Failed to update profile in router ${router.name}:`,
        routerErr,
      );
    }
  }
}

async function createProfileOnAssignedRouter(
  profilePPP: ProfilePPPRecord,
  data: ProfilePPPSchema,
  bandwidthId?: string | null,
) {
  if (!data.mikroTikRouterId || !profilePPP.mikroTikRouter) {
    return;
  }

  const rateLimit = await getRateLimitFromBandwidth(profilePPP.id, bandwidthId);
  await createPPPProfileInMikroTik(
    data.mikroTikRouterId,
    buildAssignedRouterProfilePayload(data, rateLimit),
  );
}

async function updateProfileOnAssignedRouter(
  oldProfile: ProfilePPPRecord,
  profilePPP: ProfilePPPRecord,
  data: ProfilePPPSchema,
  bandwidthId?: string | null,
) {
  if (!data.mikroTikRouterId || !profilePPP.mikroTikRouter) {
    return;
  }

  const rateLimit = await getRateLimitFromBandwidth(profilePPP.id, bandwidthId);
  await updatePPPProfileInMikroTik(
    data.mikroTikRouterId,
    oldProfile.name,
    buildAssignedRouterProfilePayload(data, rateLimit),
  );
}

function buildBroadcastProfilePayload(data: ProfilePPPSchema) {
  const isRadiusPool = data.poolMode === "RADIUS";
  return {
    name: data.name,
    localAddress: data.localAddress,
    remoteAddress: data.remoteAddress,
    ...(!isRadiusPool && data.ipRange && { ipRange: data.ipRange }),
    ...(data.dnsServer && { dnsServer: data.dnsServer }),
    ...(data.sessionTimeout && { sessionTimeout: data.sessionTimeout }),
    ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
    skipPoolCheck: isRadiusPool,
    skipRateLimit: true,
  };
}

function buildAssignedRouterProfilePayload(
  data: ProfilePPPSchema,
  rateLimit: string | null,
) {
  return {
    name: data.name,
    localAddress: data.localAddress,
    remoteAddress: data.remoteAddress,
    ...(data.ipRange && { ipRange: data.ipRange }),
    ...(data.dnsServer && { dnsServer: data.dnsServer }),
    ...(data.sessionTimeout && { sessionTimeout: data.sessionTimeout }),
    ...(data.idleTimeout && { idleTimeout: data.idleTimeout }),
    ...(rateLimit && { rateLimit }),
    skipPoolCheck: false,
  };
}
