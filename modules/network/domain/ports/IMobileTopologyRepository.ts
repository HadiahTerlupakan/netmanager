import type { MobileTopologyEntity } from "../entities/MobileTopologyEntity";

export interface IMobileTopologyRepository {
  /** Get raw topology records for mobile topology view. */
  getTopologyData(tenantId: string): Promise<MobileTopologyEntity>;
}
