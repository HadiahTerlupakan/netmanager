import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { MikroTikPPPSecretService } from "./MikroTikPPPSecretService";

export function createMikroTikPPPSecretService() {
  return new MikroTikPPPSecretService({
    networkRepository: new NetworkRepository(),
    routerRepository: new MikroTikRouterRepository(),
  });
}
