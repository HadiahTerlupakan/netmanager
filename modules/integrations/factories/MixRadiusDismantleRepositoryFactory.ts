import type { IMixRadiusDismantleRepository } from "../domain/ports/IMixRadiusDismantleRepository";
import { MixRadiusDismantleRepository } from "../repositories/MixRadiusDismantleRepository";

/** Buat repository dismantle MixRadius untuk wiring service. */
export function createMixRadiusDismantleRepository(): IMixRadiusDismantleRepository {
  return new MixRadiusDismantleRepository();
}
