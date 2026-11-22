import {
  getGoodsReceiptService,
  ProcurementService,
} from "@/modules/procurement";

import { RestockGoodsReceiptRepository } from "../repositories/RestockGoodsReceiptRepository";
import { RestockRequestRedisLock } from "../repositories/RestockRequestRedisLock";
import {
  RestockGoodsReceiptService,
  type RestockGoodsReceiptCreator,
} from "../services/RestockGoodsReceiptService";
import { RestockItemSubstitutionService } from "../services/RestockItemSubstitutionService";

/** Catatan barang masuk dibuat lewat service GRN procurement. */
const procurementGoodsReceiptCreator: RestockGoodsReceiptCreator = {
  create: (input) => getGoodsReceiptService().create(input),
};

/** Rakit service Lapor Barang Sampai restock beserta dependency konkretnya. */
export function createRestockGoodsReceiptService(): RestockGoodsReceiptService {
  const repository = new RestockGoodsReceiptRepository();
  return new RestockGoodsReceiptService({
    repository,
    substitutionService: new RestockItemSubstitutionService(repository),
    purchaseOrderGenerator: new ProcurementService(),
    goodsReceiptCreator: procurementGoodsReceiptCreator,
    lock: new RestockRequestRedisLock(),
  });
}
