"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";
import {
  buildItemChangePayload,
  getItemChangeBlocker,
  getMinimumQuantity,
  previewGrandTotal,
  type ChangeableItem,
  type DraftAddition,
  type ItemChangeDraft,
} from "./po-item-change";

interface BarangOption {
  id: string;
  nama: string;
}

interface Props {
  poId: string;
  items: ChangeableItem[];
  jasaSubtotal: number;
  ppnRate: number;
  grandTotal: number;
  onChanged: () => Promise<unknown>;
}

const EMPTY_DRAFT: ItemChangeDraft = {
  quantities: {},
  additions: [],
  reason: "",
};
// Batas maksimal yang dilayani /api/inventory/barang; sisanya lewat pencarian.
const BARANG_SEARCH_LIMIT = 100;
const INPUT_CLASS =
  "px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Ubah isi PO yang sudah dipesan, misalnya saat supplier mengganti sebagian
 * pesanan dengan barang lain. Baris lama dikurangi, barang baru ditambah
 * dengan harganya sendiri, dan gudang langsung melihat sisa yang baru.
 */
export function PurchaseOrderItemChangePanel({
  poId,
  items,
  jasaSubtotal,
  ppnRate,
  grandTotal,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ItemChangeDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [barangSearch, setBarangSearch] = useState("");
  const debouncedSearch = useDebounce(barangSearch.trim(), 300);
  const { data: barangData } = useApi<{ barangs: BarangOption[] }>(
    open
      ? `/api/inventory/barang?limit=${BARANG_SEARCH_LIMIT}${
          debouncedSearch
            ? `&search=${encodeURIComponent(debouncedSearch)}`
            : ""
        }`
      : null,
  );
  const barangList = barangData?.barangs ?? [];

  const blocker = getItemChangeBlocker(items, draft);
  const newGrandTotal = previewGrandTotal(items, draft, jasaSubtotal, ppnRate);

  const setQuantity = (itemId: string, quantity: number) =>
    setDraft((prev) => ({
      ...prev,
      quantities: { ...prev.quantities, [itemId]: quantity },
    }));

  const updateAddition = (key: string, patch: Partial<DraftAddition>) =>
    setDraft((prev) => ({
      ...prev,
      additions: prev.additions.map((addition) =>
        addition.key === key ? { ...addition, ...patch } : addition,
      ),
    }));

  const addAddition = () =>
    setDraft((prev) => ({
      ...prev,
      additions: [
        ...prev.additions,
        {
          key: crypto.randomUUID(),
          barangId: "",
          barangName: "",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));

  const removeAddition = (key: string) =>
    setDraft((prev) => ({
      ...prev,
      additions: prev.additions.filter((addition) => addition.key !== key),
    }));

  const close = () => {
    setDraft(EMPTY_DRAFT);
    setBarangSearch("");
    setOpen(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/procurement/purchase-orders/${poId}/items`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildItemChangePayload(items, draft)),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah isi PO");
      toast.success("Isi Purchase Order diperbarui");
      close();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah isi PO");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ubah Isi Pesanan
      </Button>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl shadow-sm p-5 space-y-4">
      <div>
        <h2 className="font-medium">Ubah Isi Pesanan</h2>
        <p className="text-sm text-gray-500">
          Kurangi jumlah barang yang diganti supplier, lalu tambahkan barang
          penggantinya dengan harganya sendiri.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>
              {item.barang?.nama ?? "—"}
              <span className="block text-xs text-gray-500">
                Dipesan {item.quantity} · minimal {getMinimumQuantity(item)}
              </span>
            </span>
            <input
              type="number"
              min={getMinimumQuantity(item)}
              aria-label={`Jumlah baru ${item.barang?.nama ?? "barang"}`}
              value={draft.quantities[item.id] ?? item.quantity}
              onChange={(e) => setQuantity(item.id, Number(e.target.value))}
              className={`w-28 text-right ${INPUT_CLASS}`}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        {draft.additions.length > 0 && (
          <input
            type="search"
            aria-label="Cari barang tambahan"
            placeholder="Cari barang tambahan, misalnya kabel 2 core"
            value={barangSearch}
            onChange={(e) => setBarangSearch(e.target.value)}
            className={`w-full ${INPUT_CLASS}`}
          />
        )}
        {draft.additions.map((addition) => (
          <div key={addition.key} className="flex flex-wrap gap-2 items-center">
            <select
              aria-label="Barang tambahan"
              value={addition.barangId}
              onChange={(e) =>
                updateAddition(addition.key, {
                  barangId: e.target.value,
                  barangName:
                    barangList.find((barang) => barang.id === e.target.value)
                      ?.nama ?? "",
                })
              }
              className={`flex-1 min-w-40 ${INPUT_CLASS}`}
            >
              <option value="">— Pilih barang —</option>
              {addition.barangId &&
                !barangList.some(
                  (barang) => barang.id === addition.barangId,
                ) && (
                  <option value={addition.barangId}>
                    {addition.barangName}
                  </option>
                )}
              {barangList.map((barang) => (
                <option key={barang.id} value={barang.id}>
                  {barang.nama}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              aria-label="Jumlah barang tambahan"
              value={addition.quantity}
              onChange={(e) =>
                updateAddition(addition.key, {
                  quantity: Number(e.target.value),
                })
              }
              className={`w-24 text-right ${INPUT_CLASS}`}
            />
            <input
              type="number"
              min={0}
              aria-label="Harga satuan barang tambahan"
              value={addition.unitPrice}
              onChange={(e) =>
                updateAddition(addition.key, {
                  unitPrice: Number(e.target.value),
                })
              }
              className={`w-32 text-right ${INPUT_CLASS}`}
            />
            <Button
              variant="outline"
              onClick={() => removeAddition(addition.key)}
            >
              Hapus
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={addAddition}>
          + Tambah Barang
        </Button>
      </div>

      <div>
        <label
          htmlFor="po-item-change-reason"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Alasan perubahan
        </label>
        <textarea
          id="po-item-change-reason"
          value={draft.reason}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, reason: e.target.value }))
          }
          maxLength={255}
          rows={2}
          placeholder="Contoh: supplier mengganti 2000 m ke kabel 2 core"
          className={`w-full ${INPUT_CLASS}`}
        />
      </div>

      <p className="text-sm">
        Grand total: {formatCurrency(grandTotal)} →{" "}
        <span className="font-semibold">{formatCurrency(newGrandTotal)}</span>
      </p>
      {blocker && <p className="text-sm text-amber-700">{blocker}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={!!blocker || submitting}>
          {submitting ? "Menyimpan..." : "Simpan Isi Pesanan"}
        </Button>
        <Button variant="outline" onClick={close} disabled={submitting}>
          Batal
        </Button>
      </div>
    </section>
  );
}
