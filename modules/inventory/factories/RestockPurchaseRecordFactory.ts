import { isTrustedUploadUrl } from "@/lib/upload/trusted-upload-url";

import { RestockPurchaseRecordRepository } from "../repositories/RestockPurchaseRecordRepository";
import { RestockPurchaseRecordService } from "../services/RestockPurchaseRecordService";

/** Foto nota sah hanya bila URL-nya berkas upload milik aplikasi ini. */
function isTrustedReceiptPhotoUrl(raw: string): Promise<boolean> {
  try {
    return isTrustedUploadUrl(new URL(raw));
  } catch {
    return Promise.resolve(false);
  }
}

/** Rakit service catatan belanja restock beserta dependency konkretnya. */
export function createRestockPurchaseRecordService(): RestockPurchaseRecordService {
  return new RestockPurchaseRecordService(
    new RestockPurchaseRecordRepository(),
    isTrustedReceiptPhotoUrl,
  );
}
