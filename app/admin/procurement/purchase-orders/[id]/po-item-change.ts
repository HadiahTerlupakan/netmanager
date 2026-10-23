export interface ChangeableItem {
  id: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity?: number;
  unitPrice: number;
  barang: { id: string; nama: string } | null;
}

export interface DraftAddition {
  key: string;
  barangId: string;
  /** Disimpan agar barang terpilih tetap tampil walau hasil pencarian berganti. */
  barangName: string;
  quantity: number;
  unitPrice: number;
}

export interface ItemChangeDraft {
  quantities: Record<string, number>;
  additions: DraftAddition[];
  reason: string;
}

const STATUSES_OPEN_FOR_CHANGE = ["DRAFT", "ORDERED", "PARTIAL"];
const MIN_LINE_QUANTITY = 1;
const MIN_REASON_LENGTH = 3;

export function canChangePurchaseOrderItems(status: string): boolean {
  return STATUSES_OPEN_FOR_CHANGE.includes(status);
}

/** Jumlah baris tidak boleh di bawah yang sudah diterima dan dianulir. */
export function getMinimumQuantity(item: ChangeableItem): number {
  return Math.max(
    MIN_LINE_QUANTITY,
    item.receivedQuantity + (item.cancelledQuantity ?? 0),
  );
}

function quantityOf(item: ChangeableItem, draft: ItemChangeDraft): number {
  return draft.quantities[item.id] ?? item.quantity;
}

export function buildItemChangePayload(
  items: ChangeableItem[],
  draft: ItemChangeDraft,
) {
  return {
    reason: draft.reason.trim(),
    changes: items
      .filter((item) => quantityOf(item, draft) !== item.quantity)
      .map((item) => ({ id: item.id, quantity: quantityOf(item, draft) })),
    additions: draft.additions.map(({ barangId, quantity, unitPrice }) => ({
      barangId,
      quantity,
      unitPrice,
    })),
  };
}

/** Pratinjau grand total dengan rumus yang sama seperti server. */
export function previewGrandTotal(
  items: ChangeableItem[],
  draft: ItemChangeDraft,
  jasaSubtotal: number,
  ppnRate: number,
): number {
  const subtotal =
    items.reduce(
      (sum, item) => sum + quantityOf(item, draft) * item.unitPrice,
      0,
    ) +
    draft.additions.reduce(
      (sum, addition) => sum + addition.quantity * addition.unitPrice,
      0,
    ) +
    jasaSubtotal;
  return subtotal + Math.round((subtotal * ppnRate) / 100);
}

/** Alasan tombol simpan dinonaktifkan, atau null bila perubahan siap dikirim. */
export function getItemChangeBlocker(
  items: ChangeableItem[],
  draft: ItemChangeDraft,
): string | null {
  for (const item of items) {
    const quantity = quantityOf(item, draft);
    const minimum = getMinimumQuantity(item);
    if (!Number.isInteger(quantity) || quantity < minimum) {
      return `Jumlah ${item.barang?.nama ?? "barang"} minimal ${minimum}`;
    }
  }

  const orderedBarangIds = new Set(
    items.map((item) => item.barang?.id).filter(Boolean),
  );
  const addedBarangIds = new Set<string>();
  for (const addition of draft.additions) {
    if (!addition.barangId) return "Pilih barang tambahan";
    if (orderedBarangIds.has(addition.barangId)) {
      return "Barang tambahan sudah ada di pesanan. Ubah jumlahnya saja";
    }
    if (addedBarangIds.has(addition.barangId)) {
      return "Barang tambahan tidak boleh dobel";
    }
    addedBarangIds.add(addition.barangId);
    if (!Number.isInteger(addition.quantity) || addition.quantity < 1) {
      return "Jumlah barang tambahan minimal 1";
    }
    if (addition.unitPrice < 0) return "Harga tidak boleh negatif";
  }

  const payload = buildItemChangePayload(items, draft);
  if (payload.changes.length === 0 && payload.additions.length === 0) {
    return "Belum ada perubahan";
  }
  if (payload.reason.length < MIN_REASON_LENGTH) {
    return "Isi alasan perubahan";
  }
  return null;
}
