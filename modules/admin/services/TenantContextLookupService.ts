import { TenantRepository } from "../repositories/TenantRepository";
import type { ITenantRepository } from "../domain/ports/ITenantRepository";

export interface TenantContextLookupResult {
  tenantId: string | null;
  isSuperAdmin: boolean;
}

export class TenantContextLookupService {
  constructor(
    private readonly repository: ITenantRepository = new TenantRepository(),
  ) {}

  /** Resolve tenant context from a request host value. */
  async resolveFromHost(
    host: string | null,
  ): Promise<TenantContextLookupResult | null> {
    const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();

    if (!normalizedHost) {
      return null;
    }

    const tenant = await this.repository.findActiveByDomain(normalizedHost);

    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant.id,
      isSuperAdmin: false,
    };
  }
}

let tenantContextLookupServiceInstance: TenantContextLookupService | null =
  null;

/** Return the shared tenant context lookup service lazily. */
export function getTenantContextLookupService(): TenantContextLookupService {
  if (!tenantContextLookupServiceInstance) {
    tenantContextLookupServiceInstance = new TenantContextLookupService();
  }

  return tenantContextLookupServiceInstance;
}
