import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterUpdateData,
} from "../domain/entities/MikroTikRouterEntity";
import {
  getRadiusDefaultPorts,
  getRadiusSecret,
} from "./radius-runtime.helpers";
import {
  ensureRestrictedUpdateSiteId,
  resolveRestrictedCreateSiteId,
} from "./mikrotik-router.access";

type RadiusConfig = {
  secretRadius: string;
  authPort: number;
  accountingPort: number;
};

/** Paksa parameter RADIUS runtime agar create/update router selalu sinkron. */
export async function getForcedRadiusConfig(
  networkRepository: Pick<IRouterAccessRepository, "findSettingByKey">,
): Promise<RadiusConfig> {
  const secretRadius = await getRadiusSecret(networkRepository);
  const { authPort, accountingPort } = getRadiusDefaultPorts();
  return { secretRadius, authPort, accountingPort };
}

/** Tentukan site router baru sesuai pembatasan akses user. */
export async function resolveCreateSiteId(params: {
  userId: string;
  siteId?: string | null;
  restrictedToOwnSite: boolean;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<string | null> {
  if (!params.restrictedToOwnSite) {
    return params.siteId ?? null;
  }

  return resolveRestrictedCreateSiteId({
    networkRepository: params.networkRepository,
    userId: params.userId,
    requestedSiteId: params.siteId,
  });
}

/**
 * Tentukan site target update tanpa melanggar pembatasan akses user. Pengguna
 * terbatas hanya boleh memindah router ke salah satu site-nya; tanpa `siteId`
 * site router tidak diubah.
 */
export async function resolveUpdateSiteId(params: {
  userId: string;
  siteId?: string | null;
  restrictedToOwnSite: boolean;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<string | null | undefined> {
  if (params.restrictedToOwnSite) {
    await ensureRestrictedUpdateSiteId({
      networkRepository: params.networkRepository,
      userId: params.userId,
      requestedSiteId: params.siteId,
    });
  }

  return params.siteId;
}

/** Bentuk payload create router lengkap dengan parameter runtime yang diwajibkan. */
export function buildCreateRouterData(params: {
  data: Omit<
    MikroTikRouterCreateData,
    "tenantId" | "secretRadius" | "authPort" | "accountingPort"
  >;
  tenantId: string;
  siteId: string | null;
  radiusConfig: RadiusConfig;
}): MikroTikRouterCreateData {
  return {
    ...params.data,
    apiPort: Number(params.data.apiPort),
    authPort: params.radiusConfig.authPort,
    accountingPort: params.radiusConfig.accountingPort,
    secretRadius: params.radiusConfig.secretRadius,
    siteId: params.siteId,
    tenantId: params.tenantId,
  };
}

/** Bentuk payload update router lengkap dengan parameter runtime yang diwajibkan. */
export function buildUpdateRouterData(params: {
  data: MikroTikRouterUpdateData;
  tenantId: string;
  siteId: string | null | undefined;
  radiusConfig: RadiusConfig;
}): MikroTikRouterUpdateData {
  const updateData: MikroTikRouterUpdateData = {
    ...params.data,
    authPort: params.radiusConfig.authPort,
    accountingPort: params.radiusConfig.accountingPort,
    secretRadius: params.radiusConfig.secretRadius,
    tenantId: params.tenantId,
  };

  if (params.siteId === undefined) {
    return updateData;
  }

  return { ...updateData, siteId: params.siteId };
}

/** Bentuk payload penyimpanan kredensial API generated dari hasil provisioning. */
export function buildGeneratedApiCredentialUpdate(params: {
  username?: string;
  password?: string;
}): MikroTikRouterUpdateData {
  const updateData: MikroTikRouterUpdateData = {};

  if (params.username) {
    updateData.apiUsernameGenerated = params.username;
  }

  if (params.password) {
    updateData.apiPasswordGenerated = params.password;
  }

  return updateData;
}
