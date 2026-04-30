import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";

/** Buat repository router MikroTik default. */
export function createMikroTikRouterRepository() {
  return new MikroTikRouterRepository();
}
