"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface PurchaseOrderItem {
  id: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  barang: { id: string; nama: string } | null;
}

interface PurchaseOrderJasaItem {
  id: string;
  jasaId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  jasa: { id: string; kode: string; nama: string; satuan: string };
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  ppnAmount: number;
  ppnRate: number;
  grandTotal: number;
  expectedDate: string | null;
  notes: string | null;
  fakturPajakNo: string | null;
  fakturPajakDate: string | null;
  vendorNpwp: string | null;
  createdAt: string;
  supplier: { id: string; name: string; npwp: string | null } | null;
  items: PurchaseOrderItem[];
  jasaItems?: PurchaseOrderJasaItem[];
}

interface Supplier {
  id: string;
  name: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Dipesan",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Belum Bayar",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

interface Props {
  poId: string;
}

export function PurchaseOrderEditClient({ poId }: Props) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useApi<PurchaseOrderDetail>(
    `/api/admin/procurement/purchase-orders/${poId}`,
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [jasaPrices, setJasaPrices] = useState<Record<string, number>>({});
  const [vendorNpwp, setVendorNpwp] = useState("");
  const [fakturPajakNo, setFakturPajakNo] = useState("");
  const [fakturPajakDate, setFakturPajakDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/procurement/suppliers?limit=200")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const list: Supplier[] = json?.data?.items ?? json?.data ?? [];
        setSuppliers(list);
      })
      .catch(() => {});
  }, []);

  if (data && hydratedId !== data.id) {
    setHydratedId(data.id);
    setSupplierId(data.supplier?.id ?? "");
    setItemPrices(
      Object.fromEntries(data.items.map((it) => [it.id, it.unitPrice])),
    );
    setJasaPrices(
      Object.fromEntries(
        (data.jasaItems ?? []).map((it) => [it.id, it.unitPrice]),
      ),
    );
    setVendorNpwp(data.vendorNpwp ?? "");
    setFakturPajakNo(data.fakturPajakNo ?? "");
    setFakturPajakDate(toDateInputValue(data.fakturPajakDate));
    setExpectedDate(toDateInputValue(data.expectedDate));
    setNotes(data.notes ?? "");
  }

  const editable = data?.paymentStatus !== "PAID";

  const computedSubtotal =
    (data?.items ?? []).reduce(
      (sum, it) => sum + it.quantity * (itemPrices[it.id] ?? it.unitPrice),
      0,
    ) +
    (data?.jasaItems ?? []).reduce(
      (sum, it) => sum + it.quantity * (jasaPrices[it.id] ?? it.unitPrice),
      0,
    );
  const computedPpn = Math.round(
    (computedSubtotal * (data?.ppnRate ?? 0)) / 100,
  );
  const computedGrandTotal = computedSubtotal + computedPpn;

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        supplierId: supplierId || null,
        vendorNpwp: vendorNpwp.trim() || null,
        fakturPajakNo: fakturPajakNo.trim() || null,
        fakturPajakDate: fakturPajakDate || null,
        expectedDate: expectedDate || null,
        notes: notes.trim() || null,
        items: data.items.map((it) => ({
          id: it.id,
          unitPrice: itemPrices[it.id] ?? it.unitPrice,
        })),
      };
      if ((data.jasaItems ?? []).length > 0) {
        payload.jasaItems = (data.jasaItems ?? []).map((it) => ({
          id: it.id,
          unitPrice: jasaPrices[it.id] ?? it.unitPrice,
        }));
      }
      const res = await fetch(
        `/api/admin/procurement/purchase-orders/${poId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan");
      }
      toast.success("Purchase Order diperbarui");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!data) return;
    if (
      !confirm(
        `Proses PO "${data.poNumber}" menjadi Ordered? Setelah ini PO bisa dibayar via Tagihan Belum Bayar.`,
      )
    )
      return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/admin/procurement/purchase-orders/${poId}/process`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memproses PO");
      toast.success("PO berhasil diproses menjadi Ordered");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses PO");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm(`Hapus Purchase Order "${data.poNumber}"?`)) return;
    try {
      const res = await fetch(
        `/api/admin/procurement/purchase-orders/${poId}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        throw new Error((await res.json()).error || "Gagal menghapus");
      }
      toast.success("Purchase Order dihapus");
      router.push("/admin/procurement/purchase-orders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };
  if (isLoading) {
    return (
      <ProcurementPageShell
        title="Detail Purchase Order"
        backHref="/admin/procurement/purchase-orders"
      >
        <p className="text-gray-500">Memuat...</p>
      </ProcurementPageShell>
    );
  }
  if (error || !data) {
    return (
      <ProcurementPageShell
        title="Detail Purchase Order"
        backHref="/admin/procurement/purchase-orders"
      >
        <p className="text-red-600">Gagal memuat data PO.</p>
      </ProcurementPageShell>
    );
  }

  const showGrnButton =
    data.status !== "CANCELLED" && data.status !== "RECEIVED";
  const showProcessButton = data.status === "DRAFT";
  const showPayHint = data.status === "ORDERED" || data.status === "PARTIAL";

  return (
    <ProcurementPageShell
      title={data.poNumber}
      subtitle={`Status: ${STATUS_LABEL[data.status] ?? data.status} · ${
        PAYMENT_LABEL[data.paymentStatus] ?? data.paymentStatus
      } · ${formatDate(data.createdAt)}`}
      backHref="/admin/procurement/purchase-orders"
      actions={
        <div className="flex flex-wrap gap-2">
          {showProcessButton && (
            <Button
              onClick={handleProcess}
              disabled={processing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {processing ? "Memproses..." : "Proses Order"}
            </Button>
          )}
          {showPayHint && data.paymentStatus !== "PAID" && (
            <Link
              href="/admin/finance/unpaid"
              className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
            >
              Bayar di Tagihan
            </Link>
          )}
          {showGrnButton && (
            <Link
              href={`/admin/procurement/goods-receipts/create?poId=${data.id}`}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              Buat GRN
            </Link>
          )}
          {data.paymentStatus === "UNPAID" && data.status === "DRAFT" && (
            <Button variant="outline" onClick={handleDelete}>
              Hapus PO
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        <div className="lg:col-span-2 space-y-6">
          {data.items.length > 0 && (
            <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5">
              <h2 className="font-medium mb-4">Item Barang</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Barang</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Diterima
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Harga / Unit
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">{it.barang?.nama ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {it.receivedQuantity}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editable ? (
                          <input
                            type="number"
                            min="0"
                            value={itemPrices[it.id] ?? it.unitPrice}
                            onChange={(e) =>
                              setItemPrices((prev) => ({
                                ...prev,
                                [it.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-32 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-right text-sm bg-white dark:bg-gray-800"
                          />
                        ) : (
                          formatCurrency(it.unitPrice)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(
                          it.quantity * (itemPrices[it.id] ?? it.unitPrice),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {(data.jasaItems ?? []).length > 0 && (
            <section className="bg-white dark:bg-gray-900 border border-violet-100 dark:border-violet-900/40 rounded-2xl shadow-sm p-5">
              <h2 className="font-medium mb-4 text-violet-700 dark:text-violet-300">
                Item Jasa
              </h2>
              <table className="w-full text-sm">
                <thead className="bg-violet-50/80 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Jasa</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium text-right">Satuan</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Harga / Unit
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data.jasaItems ?? []).map((it) => (
                    <tr
                      key={it.id}
                      className="border-t border-violet-50 dark:border-violet-900/20"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.jasa.nama}</div>
                        <div className="text-xs text-gray-400">
                          {it.jasa.kode}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {it.jasa.satuan}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editable ? (
                          <input
                            type="number"
                            min="0"
                            value={jasaPrices[it.id] ?? it.unitPrice}
                            onChange={(e) =>
                              setJasaPrices((prev) => ({
                                ...prev,
                                [it.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-32 px-2 py-1 border border-violet-200 dark:border-violet-700 rounded text-right text-sm bg-white dark:bg-gray-800"
                          />
                        ) : (
                          formatCurrency(it.unitPrice)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-violet-700 dark:text-violet-300">
                        {formatCurrency(
                          it.quantity * (jasaPrices[it.id] ?? it.unitPrice),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-right text-gray-600">
                    Subtotal
                  </td>
                  <td className="px-3 py-2 text-right font-medium w-40">
                    {formatCurrency(computedSubtotal)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-right text-gray-600">
                    PPN ({data.ppnRate}%)
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(computedPpn)}
                  </td>
                </tr>
                <tr className="border-t-2">
                  <td className="px-3 py-2 text-right font-semibold">
                    Grand Total
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(computedGrandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5">
            <h2 className="font-medium mb-4">Vendor & Faktur Pajak</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier
                </label>
                {editable ? (
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">— Tanpa supplier —</option>
                    {suppliers
                      .filter((s) => s.status === "ACTIVE")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-sm">
                    {data.supplier?.name ?? (
                      <span className="text-gray-400">— Tanpa supplier —</span>
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NPWP Vendor
                </label>
                <input
                  type="text"
                  value={vendorNpwp}
                  onChange={(e) => setVendorNpwp(e.target.value)}
                  disabled={!editable}
                  maxLength={16}
                  placeholder="15 atau 16 digit"
                  className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  No. Faktur Pajak
                </label>
                <input
                  type="text"
                  value={fakturPajakNo}
                  onChange={(e) => setFakturPajakNo(e.target.value)}
                  disabled={!editable}
                  className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Untuk klaim PPN Masukan saat PO dibayar.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Faktur Pajak
                </label>
                <input
                  type="date"
                  value={fakturPajakDate}
                  onChange={(e) => setFakturPajakDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  disabled={!editable}
                  className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Catatan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!editable}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
                />
              </div>
              {editable && (
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              )}
            </div>
          </section>
        </form>
      </div>
    </ProcurementPageShell>
  );
}
