"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface GoodsReceiptItemDetail {
  id: string;
  purchaseOrderItemId: string;
  barangId: string;
  barangNama: string | null;
  barangKode: string | null;
  quantity: number;
  notes: string | null;
  poItemQuantity: number | null;
  poItemReceivedQuantity: number | null;
  poItemUnitPrice: number | null;
}

interface GoodsReceiptDetail {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string | null;
  gudangId: string;
  gudangNama: string | null;
  receivedById: string;
  receiverName: string | null;
  receivedAt: string;
  status: string;
  notes: string | null;
  fotoBukti: string[];
  createdAt: string;
  updatedAt: string;
  items: GoodsReceiptItemDetail[];
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  POSTED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const ID_FORMATTER = new Intl.NumberFormat("id-ID");

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRupiah(n: number): string {
  return `Rp ${ID_FORMATTER.format(Math.round(n))}`;
}

export function GoodsReceiptDetailClient({ grnId }: { grnId: string }) {
  const [data, setData] = useState<GoodsReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/procurement/goods-receipts/${grnId}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).error || "Gagal memuat GRN");
        }
        const json = await res.json();
        if (!cancelled) setData(json.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat GRN");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grnId]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">GRN tidak ditemukan.</div>
    );
  }

  const totalQty = data.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalNilai = data.items.reduce(
    (sum, it) => sum + it.quantity * (it.poItemUnitPrice ?? 0),
    0,
  );

  return (
    <ProcurementPageShell
      title="Detail Goods Receipt"
      backHref="/admin/procurement/goods-receipts"
      actions={
        data.status === "POSTED" ? (
          <Link
            href={`/admin/procurement/goods-returns/create?grnId=${data.id}`}
            className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
          >
            Buat Retur ke Vendor
          </Link>
        ) : null
      }
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 mb-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info
            label="No. GRN"
            value={<span className="font-mono">{data.grnNumber}</span>}
          />
          <Info
            label="Status"
            value={
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  STATUS_BADGE[data.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {data.status}
              </span>
            }
          />
          <Info
            label="Purchase Order"
            value={
              data.poNumber ? (
                <Link
                  href={`/admin/procurement/purchase-orders/${data.purchaseOrderId}`}
                  className="text-blue-600 hover:underline font-mono"
                >
                  {data.poNumber}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Info label="Gudang" value={data.gudangNama ?? "—"} />
          <Info label="Tanggal Terima" value={formatDate(data.receivedAt)} />
          <Info label="Penerima" value={data.receiverName ?? "—"} />
          {data.notes && <Info label="Catatan" value={data.notes} fullWidth />}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Barang</th>
              <th className="px-4 py-3 font-medium text-right">Qty Diterima</th>
              <th className="px-4 py-3 font-medium text-right">Harga Satuan</th>
              <th className="px-4 py-3 font-medium text-right">Subtotal</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{it.barangNama ?? "—"}</div>
                  {it.barangKode && (
                    <div className="text-xs text-gray-500 font-mono">
                      {it.barangKode}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{it.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {it.poItemUnitPrice ? formatRupiah(it.poItemUnitPrice) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {it.poItemUnitPrice
                    ? formatRupiah(it.quantity * it.poItemUnitPrice)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{it.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr className="border-t">
              <td className="px-4 py-3 text-right font-medium" colSpan={1}>
                Total
              </td>
              <td className="px-4 py-3 text-right font-medium">{totalQty}</td>
              <td></td>
              <td className="px-4 py-3 text-right font-mono font-medium">
                {formatRupiah(totalNilai)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ProcurementPageShell>
  );
}

function Info({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : undefined}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-gray-900">{value}</div>
    </div>
  );
}
