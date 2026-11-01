import { getWithAuth } from "@/lib/api-client";

import { requestTransferApi } from "./transferRequest";
import type { Transfer } from "./useTransferList";

/**
 * Fetch detail satu transfer untuk modal detail.
 * Diekspos terpisah agar mudah diinjeksi & ditest tanpa render parent.
 */
export async function fetchTransferDetail(
  request: typeof getWithAuth,
  transferId: string,
): Promise<Transfer> {
  const result = await requestTransferApi<{ transfer?: Transfer } & Transfer>(
    () => request(`/api/inventory/transfer/${transferId}`),
    "Detail transfer gagal dimuat. Muat ulang halaman, lalu coba lagi.",
  );
  return result.transfer || result;
}
