import { ProcurementService } from "@/modules/procurement";

import { RestockGoodsReceiptRepository } from "../repositories/RestockGoodsReceiptRepository";
import { RestockGoodsReceiptService } from "../services/RestockGoodsReceiptService";
import { RestockItemCancellationService } from "../services/RestockItemCancellationService";
import { RestockItemSubstitutionService } from "../services/RestockItemSubstitutionService";

/** Rakit service verifikasi kedatangan restock beserta dependency konkretnya. */
export function createRestockGoodsReceiptService(): RestockGoodsReceiptService {
  const repository = new RestockGoodsReceiptRepository();
  return new RestockGoodsReceiptService(
    repository,
    new RestockItemSubstitutionService(repository),
    new RestockItemCancellationService(repository),
    new ProcurementService(),
  );
}
