import type { IMixRadiusDataRepository } from "../domain/ports/IMixRadiusDataRepository";
import { MixRadiusRepository } from "../repositories/MixRadiusRepository";

/** Buat repository data MixRadius untuk wiring service. */
export function createMixRadiusDataRepository(): IMixRadiusDataRepository {
  return new MixRadiusRepository();
}
