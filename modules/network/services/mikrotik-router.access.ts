import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type { MikroTikRouterEntity } from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";

export class RouterAccessDeniedError extends Error {}
export class RouterNotFoundError extends Error {}

export async function resolveRestrictedSiteId(
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">,
  userId: string,
): Promise<string | null> {
  const user = await networkRepository.findUserSite(userId);
  return user?.siteId ?? null;
}

async function requireRouter(params: {
  id: string;
  tenantId: string;
  routerRepository: Pick<IMikroTikRouterRepository, "findById">;
}): Promise<MikroTikRouterEntity> {
  const router = await params.routerRepository.findById(
    params.id,
    params.tenantId,
  );

  if (!router) {
    throw new RouterNotFoundError("Router tidak ditemukan");
  }

  return router;
}

async function ensureRouterSiteAccess(params: {
  router: MikroTikRouterEntity;
  userId: string;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<void> {
  const userSiteId = await resolveRestrictedSiteId(
    params.networkRepository,
    params.userId,
  );

  if (!userSiteId || params.router.siteId !== userSiteId) {
    throw new RouterAccessDeniedError("Akses ditolak");
  }
}

export async function getAuthorizedRouter(params: {
  id: string;
  tenantId: string;
  userId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "findById">;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
}): Promise<MikroTikRouterEntity> {
  const router = await requireRouter(params);

  if (params.restrictedToOwnSite) {
    await ensureRouterSiteAccess({
      router,
      userId: params.userId,
      networkRepository: params.networkRepository,
    });
  }

  return router;
}
