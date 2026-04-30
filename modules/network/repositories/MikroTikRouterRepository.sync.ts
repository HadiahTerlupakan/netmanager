import { logger } from "@/lib/logger";
import type { MikroTikRouterUpdateData } from "../domain/entities/MikroTikRouterEntity";
import { RadiusRepository } from "./RadiusRepository";

type RouterNasSnapshot = {
  ipAddress: string;
  secretRadius: string;
  name: string;
  tenantId: string | null;
};

/** Sync new router NAS entry into RADIUS. */
export async function syncNasOnRouterCreate(
  radiusRepo: RadiusRepository,
  router: {
    ipAddress: string;
    secretRadius: string;
    name: string;
    description: string | null;
    tenantId: string | null;
  },
  apiPort: number,
): Promise<void> {
  try {
    if (!router.tenantId) {
      return;
    }

    await radiusRepo.createNas(
      {
        nasname: router.ipAddress,
        shortname: router.name,
        type: "other",
        ports: apiPort,
        secret: router.secretRadius,
        description: router.description || `Auto-sync: MikroTik ${router.name}`,
        community: "public",
      },
      router.tenantId,
    );
  } catch (error) {
    logger.error(`Failed to sync NAS for router ${router.name}:`, error);
  }
}

/** Check whether router update requires NAS synchronization. */
export function shouldSyncNasOnUpdate(
  existingRouter: RouterNasSnapshot,
  data: MikroTikRouterUpdateData,
): boolean {
  return Boolean(
    (data.ipAddress && data.ipAddress !== existingRouter.ipAddress) ||
    (data.secretRadius && data.secretRadius !== existingRouter.secretRadius) ||
    (data.name && data.name !== existingRouter.name) ||
    data.description !== undefined ||
    data.apiPort !== undefined,
  );
}

/** Sync NAS changes after router update. */
export async function syncNasOnRouterUpdate(
  radiusRepo: RadiusRepository,
  existingRouter: RouterNasSnapshot,
  data: MikroTikRouterUpdateData,
): Promise<void> {
  try {
    if (!existingRouter.tenantId) {
      return;
    }

    const existingNas = await radiusRepo.getNasByIp(
      existingRouter.ipAddress,
      existingRouter.tenantId,
    );
    const newNasData = {
      nasname: data.ipAddress ?? existingRouter.ipAddress,
      secret: data.secretRadius ?? existingRouter.secretRadius,
      shortname: data.name ?? existingRouter.name,
      ...(data.description !== undefined
        ? { description: data.description ?? "" }
        : {}),
    };

    if (existingNas?.id) {
      await radiusRepo.updateNas(
        existingNas.id,
        newNasData,
        existingRouter.tenantId,
      );
      return;
    }

    await radiusRepo.createNas(
      {
        ...newNasData,
        type: "other",
        ports: data.apiPort ?? 8728,
        community: "public",
      },
      existingRouter.tenantId,
    );
  } catch (error) {
    logger.error(
      `Failed to sync NAS update for router ${existingRouter.ipAddress}:`,
      error,
    );
  }
}

/** Validate router deletion relation constraints. */
export function validateRouterDeletion(router: {
  name: string;
  profilePPP: Array<{
    name: string;
    hargaPaket: Array<{ id: string }>;
  }>;
}): void {
  if (router.profilePPP.length === 0) {
    return;
  }

  const profileNames = router.profilePPP
    .map((profile) => profile.name)
    .join(", ");
  const hasActivePackages = router.profilePPP.some(
    (profile) => profile.hargaPaket.length > 0,
  );

  if (hasActivePackages) {
    throw new Error(
      `Router "${router.name}" tidak dapat dihapus karena masih memiliki ${router.profilePPP.length} Profile PPP yang terhubung (${profileNames}) dan beberapa memiliki paket harga aktif. Hapus atau pindahkan Profile PPP terlebih dahulu.`,
    );
  }

  throw new Error(
    `Router "${router.name}" tidak dapat dihapus karena masih memiliki ${router.profilePPP.length} Profile PPP yang terhubung (${profileNames}). Hapus atau pindahkan Profile PPP terlebih dahulu.`,
  );
}

/** Remove NAS entry after router deletion. */
export async function syncNasOnRouterDelete(
  radiusRepo: RadiusRepository,
  input: { ipAddress: string; tenantId: string | null },
  routerId: string,
): Promise<void> {
  try {
    if (!input.tenantId) {
      return;
    }

    const nas = await radiusRepo.getNasByIp(input.ipAddress, input.tenantId);
    if (nas?.id) {
      await radiusRepo.deleteNas(nas.id, input.tenantId);
    }
  } catch (error) {
    logger.error(`Failed to delete NAS for router ${routerId}:`, error);
  }
}
