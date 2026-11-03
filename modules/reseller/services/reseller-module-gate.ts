import { getFeatureFlagService } from "@/modules/feature-flags";
import type { IResellerModuleGate } from "../domain/ports/IResellerModuleGate";

const RESELLER_FEATURE = "reseller";

/** Gerbang modul reseller yang membaca feature flag tenant. */
export class FeatureFlagResellerModuleGate implements IResellerModuleGate {
  /** True bila tenant tidak menonaktifkan modul reseller. */
  async isEnabled(tenantId: string): Promise<boolean> {
    return getFeatureFlagService().isEnabled(tenantId, RESELLER_FEATURE);
  }
}
