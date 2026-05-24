"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

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
  items: Array<{
    id: string;
    barangId: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: number;
    totalPrice: number;
    barang: { id: string; nama: string } | null;
  }>;
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

  const [vendorNpwp, setVendorNpwp] = useState("");
  const [fakturPajakNo, setFakturPajakNo] = useState("");
  const [fakturPajakDate, setFakturPajakDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  if (data && hydratedId !== data.id) {
    setHydratedId(data.id);
    setVendorNpwp(data.vendorNpwp ?? "");
    setFakturPajakNo(data.fakturPajakNo ?? "");
    setFakturPajakDate(toDateInputValue(data.fakturPajakDate));
    setExpectedDate(toDateInputValue(data.expectedDate));
    setNotes(data.notes ?? "");
  }

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        vendorNpwp: vendorNpwp.trim() || null,
        fakturPajakNo: fakturPajakNo.trim() || null,
        fakturPajakDate: fakturPajakDate || null,
        expectedDate: expectedDate || null,
        notes: notes.trim() || null,
      };
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
    return <div className="p-6">Memuat...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">Gagal memuat data PO.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/procurement/purchase-orders"
            className="p-2 hover:bg-gray-100 rounded"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{data.poNumber}</h1>
            <p className="text-sm text-gray-600">
              Status: {STATUS_LABEL[data.status] ?? data.status} ·{" "}
              {PAYMENT_LABEL[data.paymentStatus] ?? data.paymentStatus} ·{" "}
              {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
        {data.paymentStatus === "UNPAID" && (
          <div className="flex gap-2">
            <Link
              href={`/admin/procurement/goods-receipts/create?poId=${data.id}`}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              Buat GRN
            </Link>
            <Button variant="outline" onClick={handleDelete}>
              Hapus PO
            </Button>
          </div>
        )}
        {data.paymentStatus !== "UNPAID" && data.status !== "RECEIVED" && (
          <Link
            href={`/admin/procurement/goods-receipts/create?poId=${data.id}`}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
          >
            Buat GRN
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border rounded-lg p-5">
            <h2 className="font-medium mb-4">Item PO</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-700">
                  <th className="px-3 py-2 font-medium">Barang</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Diterima</th>
                  <th className="px-3 py-2 font-medium text-right">Harga</th>
                  <th className="px-3 py-2 font-medium text-right">Subtotal</th>
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
                      {formatCurrency(it.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(it.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-gray-600"
                  >
                    Subtotal
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(data.totalAmount)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-gray-600"
                  >
                    PPN ({data.ppnRate}%)
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(data.ppnAmount)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right font-semibold"
                  >
                    Grand Total
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(data.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="bg-white border rounded-lg p-5">
            <h2 className="font-medium mb-4">Vendor & Faktur Pajak</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <p className="text-sm">
                  {data.supplier?.name ?? (
                    <span className="text-gray-400">— Tanpa supplier —</span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NPWP Vendor
                </label>
                <input
                  type="text"
                  value={vendorNpwp}
                  onChange={(e) => setVendorNpwp(e.target.value)}
                  maxLength={16}
                  placeholder="15 atau 16 digit"
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. Faktur Pajak
                </label>
                <input
                  type="text"
                  value={fakturPajakNo}
                  onChange={(e) => setFakturPajakNo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
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
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
