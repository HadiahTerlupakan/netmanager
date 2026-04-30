import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { MikroTikPPPSecretService } from "../services/MikroTikPPPSecretService";

/** Buat service PPP Secret dengan dependency repository default. */
export function createMikroTikPPPSecretService() {
  return new MikroTikPPPSecretService({
    networkRepository: new NetworkRepository(),
    routerRepository: new MikroTikRouterRepository(),
  });
}
