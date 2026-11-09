import { RestockPurchaseLinkRepository } from "../repositories/RestockPurchaseLinkRepository";
import { RestockPurchaseRecordRepository } from "../repositories/RestockPurchaseRecordRepository";
import { RestockSignatureStorage } from "../repositories/RestockSignatureStorage";
import { RestockPublicPurchaseService } from "../services/RestockPublicPurchaseService";
import { RestockPurchaseLinkService } from "../services/RestockPurchaseLinkService";
import { RestockPurchaseSignatureReader } from "../services/RestockPurchaseSignatureReader";
import { createRestockPurchaseRecordService } from "./RestockPurchaseRecordFactory";

/** Rakit service link belanja untuk panel admin. */
export function createRestockPurchaseLinkService(): RestockPurchaseLinkService {
  return new RestockPurchaseLinkService(
    new RestockPurchaseLinkRepository(),
    new RestockPurchaseRecordRepository(),
    new RestockSignatureStorage(),
  );
}

/** Rakit service daftar & catat belanja lewat link tanpa login. */
export function createRestockPublicPurchaseService(): RestockPublicPurchaseService {
  return new RestockPublicPurchaseService(
    new RestockPurchaseLinkRepository(),
    new RestockPurchaseRecordRepository(),
    createRestockPurchaseRecordService(),
    new RestockSignatureStorage(),
  );
}

/** Rakit pembaca gambar tanda tangan pembeli untuk admin. */
export function createRestockPurchaseSignatureReader(): RestockPurchaseSignatureReader {
  return new RestockPurchaseSignatureReader(
    new RestockPurchaseRecordRepository(),
    new RestockSignatureStorage(),
  );
}
