"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface RtvItem {
  id: string;
  goodsReceiptItemId: string;
  barangId: string;
  barangNama: string | null;
  barangKode: string | null;
  quantity: number;
  notes: string | null;
  unitPrice: number | null;
}

interface RtvDetail {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  grnNumber: string | null;
  supplierName: string | null;
  gudangNama: string | null;
  reason: string;
  status: string;
  returnerName: string | null;
  returnedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  refundAmount: number | null;
  replacementGrnId: string | null;
  creditNoteRef: string | null;
  items: RtvItem[];
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-orange-100 text-orange-700",
  REFUNDED: "bg-green-100 text-green-700",
  REPLACED: "bg-blue-100 text-blue-700",
  CREDIT_NOTE: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const REASON_LABEL: Record<string, string> = {
  DAMAGED: "Rusak",
  WRONG_SPEC: "Tidak Sesuai Spek",
  EXCESS: "Kelebihan Kirim",
  OTHER: "Lainnya",
};

const ID_FORMATTER = new Intl.NumberFormat("id-ID");

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRupiah(n: number | null): string {
  if (n === null) return "—";
  return `Rp ${ID_FORMATTER.format(Math.round(n))}`;
}

export function GoodsReturnDetailClient({ rtvId }: { rtvId: string }) {
  const [data, setData] = useState<RtvDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/procurement/goods-returns/${rtvId}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).error || "Gagal memuat RTV");
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json.data);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Gagal memuat RTV");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rtvId, refreshTick]);

  const handleResolve = async (
    status: "REFUNDED" | "REPLACED" | "CREDIT_NOTE" | "CANCELLED",
  ) => {
    let extraPayload: Record<string, unknown> = {};
    if (status === "REFUNDED") {
      const amountStr = window.prompt(
        "Jumlah refund (Rupiah, kosongkan kalau belum ada):",
        "",
      );
      if (amountStr === null) return;
      const amount = parseFloat(amountStr);
      extraPayload = {
        refundAmount: Number.isFinite(amount) && amount >= 0 ? amount : null,
      };
    }
    if (status === "CREDIT_NOTE") {
      const ref = window.prompt("Nomor / referensi credit note:", "");
      if (ref === null) return;
      extraPayload = { creditNoteRef: ref || null };
    }
    if (status === "REPLACED") {
      const grnRef = window.prompt("ID GRN replacement (opsional):", "");
      if (grnRef === null) return;
      extraPayload = { replacementGrnId: grnRef || null };
    }
    if (status === "CANCELLED") {
      if (
        !window.confirm(
          "Yakin batalkan RTV ini? Stok yang sebelumnya dikurangi akan dikembalikan.",
        )
      )
        return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/procurement/goods-returns/${rtvId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extraPayload }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal update status");
      }
      toast.success(json.message || "Status berhasil diperbarui");
      setRefreshTick((tick) => tick + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update status");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">RTV tidak ditemukan.</div>
    );
  }

  const totalQty = data.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalNilai = data.items.reduce(
    (sum, it) => sum + it.quantity * (it.unitPrice ?? 0),
    0,
  );
  const canResolve = data.status === "SENT";

  return (
    <ProcurementPageShell
      title="Detail Retur Vendor"
      backHref="/admin/procurement/goods-returns"
      actions={
        canResolve ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve("REFUNDED")}
              disabled={submitting}
            >
              Refunded
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolve("REPLACED")}
              disabled={submitting}
            >
              Replaced
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolve("CREDIT_NOTE")}
              disabled={submitting}
            >
              Credit Note
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolve("CANCELLED")}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        ) : null
      }
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-5 mb-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info
            label="No. RTV"
            value={<span className="font-mono">{data.rtvNumber}</span>}
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
            label="GRN"
            value={
              data.grnNumber ? (
                <Link
                  href={`/admin/procurement/goods-receipts/${data.goodsReceiptId}`}
                  className="text-blue-600 hover:underline font-mono"
                >
                  {data.grnNumber}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Info
            label="Alasan"
            value={REASON_LABEL[data.reason] ?? data.reason}
          />
          <Info label="Supplier" value={data.supplierName ?? "—"} />
          <Info label="Gudang" value={data.gudangNama ?? "—"} />
          <Info label="Tanggal Retur" value={formatDate(data.returnedAt)} />
          <Info label="Penanggung Jawab" value={data.returnerName ?? "—"} />
          {data.resolvedAt && (
            <Info label="Resolved At" value={formatDate(data.resolvedAt)} />
          )}
          {data.refundAmount !== null && (
            <Info label="Refund" value={formatRupiah(data.refundAmount)} />
          )}
          {data.creditNoteRef && (
            <Info label="Credit Note Ref" value={data.creditNoteRef} />
          )}
          {data.replacementGrnId && (
            <Info label="Replacement GRN" value={data.replacementGrnId} />
          )}
          {data.notes && <Info label="Catatan" value={data.notes} fullWidth />}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Barang</th>
              <th className="px-4 py-3 font-medium text-right">Qty Diretur</th>
              <th className="px-4 py-3 font-medium text-right">Harga Satuan</th>
              <th className="px-4 py-3 font-medium text-right">Subtotal</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr
                key={it.id}
                className="border-t border-gray-100 dark:border-gray-800"
              >
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
                  {formatRupiah(it.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {it.unitPrice
                    ? formatRupiah(it.quantity * it.unitPrice)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{it.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-3 text-right font-medium">Total</td>
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
