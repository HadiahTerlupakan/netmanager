/** Penyimpanan gambar tanda tangan pembeli dari link belanja. */

/** Awalan semua kunci tanda tangan belanja di penyimpanan. */
export const RESTOCK_SIGNATURE_ROOT_PREFIX = "restock-belanja/";

/** Awalan kunci tanda tangan untuk satu pengajuan di satu tenant. */
export function buildSignatureKeyPrefix(
  tenantId: string,
  purchaseRequestId: string,
): string {
  return `${RESTOCK_SIGNATURE_ROOT_PREFIX}${tenantId}/${purchaseRequestId}/`;
}

export interface IRestockSignatureStorage {
  /** True bila penyimpanan aktif dan bisa ditulisi. */
  isAvailable(): Promise<boolean>;
  /** Simpan PNG; kunci: restock-belanja/<tenantId>/<purchaseRequestId>/ttd-<uuid>.png */
  save(input: {
    tenantId: string;
    purchaseRequestId: string;
    buffer: Buffer;
  }): Promise<string>;
  /** Isi berkas, atau null bila tidak ada / kunci di luar awalan belanja. */
  read(key: string): Promise<Buffer | null>;
  /** Hapus berkas; best-effort, galat dicatat lalu ditelan. */
  remove(key: string): Promise<void>;
}
