import { RestockGoodsReceiptRepository } from "../repositories/RestockGoodsReceiptRepository";
import { RestockRequestRedisLock } from "../repositories/RestockRequestRedisLock";
import { RestockRequestCancellationService } from "../services/RestockRequestCancellationService";

/** Rakit service pembatalan pengajuan restock beserta dependency konkretnya. */
export function createRestockRequestCancellationService(): RestockRequestCancellationService {
  return new RestockRequestCancellationService(
    new RestockGoodsReceiptRepository(),
    new RestockRequestRedisLock(),
  );
}
