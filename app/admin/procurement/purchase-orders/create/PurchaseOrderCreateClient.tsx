"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { getPphLabel } from "@/modules/tax/client";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface SupplierOption {
  id: string;
  code: string;
  name: string;
  npwp: string | null;
  defaultPphCategory: string | null;
}

interface BarangOption {
  id: string;
  nama: string;
  kode?: string | null;
  hargaBeli?: number | null;
}

interface POItem {
  barangId: string;
  barangName: string;
  quantity: number;
  unitPrice: number;
}

const DEFAULT_PPN_RATE = 11;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PurchaseOrderCreateClient() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [vendorNpwp, setVendorNpwp] = useState("");
  const [defaultPphCategory, setDefaultPphCategory] = useState<string | null>(
    null,
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [ppnRate, setPpnRate] = useState<number>(DEFAULT_PPN_RATE);
  const [items, setItems] = useState<POItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: supplierData } = useApi<{ items: SupplierOption[] }>(
    "/api/admin/procurement/suppliers?limit=200",
  );
  const { data: barangData } = useApi<{ items: BarangOption[] }>(
    "/api/inventory/barang?limit=500",
  );

  const suppliers = supplierData?.items ?? [];
  const barangList = barangData?.items ?? [];

  const subtotal = items.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice,
    0,
  );
  const ppnAmount = Math.round((subtotal * ppnRate) / 100);
  const grandTotal = subtotal + ppnAmount;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { barangId: "", barangName: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateItem = (index: number, patch: Partial<POItem>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (nextSupplierId: string) => {
    setSupplierId(nextSupplierId);
    if (!nextSupplierId) {
      setVendorNpwp("");
      setDefaultPphCategory(null);
      return;
    }
    const supplier = suppliers.find((s) => s.id === nextSupplierId);
    setVendorNpwp(supplier?.npwp ?? "");
    setDefaultPphCategory(supplier?.defaultPphCategory ?? null);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 item PO");
      return;
    }
    if (items.some((it) => !it.barangId || it.quantity <= 0)) {
      toast.error("Semua item harus memilih barang dan quantity > 0");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: supplierId || null,
        vendorNpwp: vendorNpwp.trim() || null,
        expectedDate: expectedDate || null,
        notes: notes.trim() || null,
        ppnRate,
        items: items.map((it) => ({
          barangId: it.barangId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      };

      const res = await fetch("/api/admin/procurement/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat PO");
      }
      toast.success("Purchase Order berhasil dibuat");
      router.push(`/admin/procurement/purchase-orders/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat PO");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProcurementPageShell
      title="Buat Purchase Order"
      backHref="/admin/procurement/purchase-orders"
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5">
          <h2 className="font-medium mb-4">Vendor & Pajak</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— Tanpa supplier master —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              {defaultPphCategory && (
                <p className="text-xs text-blue-600 mt-1">
                  Kategori PPh otomatis:{" "}
                  {getPphLabel(defaultPphCategory) ?? defaultPphCategory}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NPWP Vendor
              </label>
              <input
                type="text"
                value={vendorNpwp}
                onChange={(e) => setVendorNpwp(e.target.value)}
                placeholder="15 atau 16 digit"
                maxLength={16}
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Otomatis terisi dari supplier; bisa di-override per PO.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PPN Rate (%)
              </label>
              <input
                type="number"
                value={ppnRate}
                onChange={(e) => setPpnRate(Number(e.target.value))}
                min={0}
                max={100}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Pengiriman (opsional)
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Item PO</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              <HiPlus className="w-4 h-4" />
              Tambah Item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              Belum ada item. Klik &quot;Tambah Item&quot; untuk mulai.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Barang</th>
                  <th className="px-3 py-2 font-medium w-28">Qty</th>
                  <th className="px-3 py-2 font-medium w-40">Harga Satuan</th>
                  <th className="px-3 py-2 font-medium w-40 text-right">
                    Subtotal
                  </th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-3 py-2">
                      <select
                        value={it.barangId}
                        onChange={(e) => {
                          const barang = barangList.find(
                            (b) => b.id === e.target.value,
                          );
                          updateItem(i, {
                            barangId: e.target.value,
                            barangName: barang?.nama ?? "",
                            unitPrice: it.unitPrice || (barang?.hargaBeli ?? 0),
                          });
                        }}
                        className="w-full px-2 py-1.5 border border-gray-100 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                        required
                      >
                        <option value="">— Pilih barang —</option>
                        {barangList.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nama}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(i, { quantity: Number(e.target.value) })
                        }
                        min={1}
                        className="w-full px-2 py-1.5 border border-gray-100 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) =>
                          updateItem(i, { unitPrice: Number(e.target.value) })
                        }
                        min={0}
                        className="w-full px-2 py-1.5 border border-gray-100 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(it.quantity * it.unitPrice)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="p-1 text-gray-500 hover:text-red-600"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 pt-4 border-t space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PPN ({ppnRate}%)</span>
              <span className="font-medium">{formatCurrency(ppnAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t">
              <span>Grand Total</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link href="/admin/procurement/purchase-orders">
            <Button variant="outline" type="button">
              Batal
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan PO"}
          </Button>
        </div>
      </form>
    </ProcurementPageShell>
  );
}
