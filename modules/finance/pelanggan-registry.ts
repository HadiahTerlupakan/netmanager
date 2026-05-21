/**
 * Lazy-loading re-exports for pelanggan module dependencies.
 * Finance module uses these instead of importing directly from pelanggan,
 * breaking the circular import chain at module load time.
 *
 * Pattern: deferred import — the top-level `import` is hoisted by the bundler
 * but the actual module body only executes once something accesses it.
 * Vitest can intercept this (unlike raw `require()`), preserving testability.
 */

import * as PelangganModule from "@/modules/pelanggan";

export function getPelangganBillingBridge() {
  return new PelangganModule.PelangganBillingBridgeService();
}

export function getPelangganServiceFromRegistry() {
  return PelangganModule.getPelangganService();
}

export function getPelangganAdminQueryFromRegistry() {
  return new PelangganModule.PelangganAdminQueryService();
}
