import { NetworkRepository } from "../../repositories/NetworkRepository";
import { createMikroTikRouterRepository } from "../../factories/MikroTikRouterRepositoryFactory";

export class MikroTikRouterResolver {
  constructor(
    private readonly networkRepository = new NetworkRepository(),
    private readonly routerRepository = createMikroTikRouterRepository(),
  ) {}

  /** Resolve MikroTik router with tenant scoping. */
  async findRouter(routerId: string) {
    const routerTenant =
      await this.networkRepository.findRouterTenantId(routerId);
    if (!routerTenant?.tenantId) return null;
    return this.routerRepository.findById(routerId, routerTenant.tenantId);
  }
}
