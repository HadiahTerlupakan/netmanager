const DEFAULT_ROUTER_ORDER = { createdAt: "desc" as const };

export function buildTenantOrGlobalScope(tenantId: string) {
  return {
    OR: [{ tenantId }, { tenantId: null }],
  };
}

export function buildRouterReconfigureSelect() {
  return {
    id: true,
    name: true,
    ipAddress: true,
    apiPort: true,
    pingStatus: true,
    apiUsername: true,
    apiPassword: true,
    apiUsernameGenerated: true,
    apiPasswordGenerated: true,
    siteId: true,
  } as const;
}

export function getDefaultRouterOrder() {
  return DEFAULT_ROUTER_ORDER;
}
