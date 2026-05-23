import { getWithAuth } from "@/lib/api-client";

import type { Transfer } from "./useTransferList";

/**
 * Fetch detail satu transfer untuk modal detail.
 * Diekspos terpisah agar mudah diinjeksi & ditest tanpa render parent.
 */
export async function fetchTransferDetail(
  request: typeof getWithAuth,
  transferId: string,
): Promise<Transfer> {
  const response = await request(`/api/inventory/transfer/${transferId}`);
  const jsonResponse = await response.json();

  if (!jsonResponse.success) {
    throw new Error(jsonResponse.error || "Gagal memuat detail transfer");
  }

  const result = jsonResponse.data || jsonResponse;
  return result.transfer || result;
}
