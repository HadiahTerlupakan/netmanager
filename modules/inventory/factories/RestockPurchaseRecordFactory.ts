import { RestockPurchaseRecordRepository } from "../repositories/RestockPurchaseRecordRepository";
import { RestockPurchaseRecordService } from "../services/RestockPurchaseRecordService";

/** Rakit service catatan belanja restock beserta dependency konkretnya. */
export function createRestockPurchaseRecordService(): RestockPurchaseRecordService {
  return new RestockPurchaseRecordService(
    new RestockPurchaseRecordRepository(),
  );
}
