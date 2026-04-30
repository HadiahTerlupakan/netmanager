import { mixRadiusOwnerGroupRepository } from "../repositories/MixRadiusOwnerGroupRepository";

/** Get singleton owner group repository for MixRadius services. */
export function getMixRadiusOwnerGroupRepository() {
  return mixRadiusOwnerGroupRepository;
}
