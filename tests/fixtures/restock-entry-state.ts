import { vi } from "vitest";

import type { RestockEntryState } from "@/app/admin/inventory/restock/useRestockEntry";

/**
 * State modal "Masukkan Barang" untuk tes komponen, tanpa menjalankan hook
 * `useRestockEntry`. Bawaannya: belum ada pengajuan yang dibuka, tanpa foto,
 * dan setiap aksi berupa mock.
 */
export function makeRestockEntryState(
  overrides: Partial<RestockEntryState> = {},
): RestockEntryState {
  return {
    request: null,
    receivedItems: {},
    setReceivedItems: vi.fn(),
    substitutions: {},
    setSubstitutions: vi.fn(),
    overReceipts: {},
    setOverReceipts: vi.fn(),
    photos: [],
    setPhotos: vi.fn(),
    isSubmitting: false,
    photoUploadRef: { current: null },
    open: vi.fn(),
    close: vi.fn(),
    submit: vi.fn(async () => {}),
    ...overrides,
  };
}
