import type { IRestockPurchaseRecordRepository } from "../domain/ports/IRestockPurchaseRecordRepository";
import {
  buildSignatureKeyPrefix,
  type IRestockSignatureStorage,
} from "../domain/ports/IRestockSignatureStorage";

/**
 * Baca gambar tanda tangan pembeli untuk admin. Catatan harus milik pesanan
 * pengajuan ini di tenant ini, dan kuncinya harus di awalan pengajuan itu.
 */
export class RestockPurchaseSignatureReader {
  constructor(
    private readonly records: Pick<
      IRestockPurchaseRecordRepository,
      "findSignatureKey"
    >,
    private readonly storage: Pick<IRestockSignatureStorage, "read">,
  ) {}

  /** Isi PNG tanda tangan, atau null bila tidak ada / bukan milik pengajuan. */
  async read(input: {
    purchaseRequestId: string;
    recordId: string;
    tenantId: string;
  }): Promise<Buffer | null> {
    const key = await this.records.findSignatureKey(input);
    if (!key) return null;
    const prefix = buildSignatureKeyPrefix(
      input.tenantId,
      input.purchaseRequestId,
    );
    if (!key.startsWith(prefix)) return null;
    return this.storage.read(key);
  }
}
