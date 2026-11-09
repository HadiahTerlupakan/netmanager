import { ProcurementService } from "@/modules/procurement";

import { RestockApprovalRepository } from "../repositories/RestockApprovalRepository";
import { RestockRequestLifecycleService } from "../services/RestockRequestLifecycleService";

/** Rakit service keputusan setuju/tolak pengajuan restock beserta dependency konkretnya. */
export function createRestockRequestLifecycleService(): RestockRequestLifecycleService {
  return new RestockRequestLifecycleService(
    new RestockApprovalRepository(),
    new ProcurementService(),
  );
}
