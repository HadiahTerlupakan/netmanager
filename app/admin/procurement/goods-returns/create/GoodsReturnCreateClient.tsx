"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface GrnItem {
  id: string;
  barangId: string;
  barangNama: string | null;
  barangKode: string | null;
  quantity: number;
  notes: string | null;
}

interface GrnDetail {
  id: string;
  grnNumber: string;
  poNumber: string | null;
  gudangNama: string | null;
  status: string;
  items: GrnItem[];
}

const REASON_OPTIONS = [
  { value: "DAMAGED", label: "Rusak / DOA" },
  { value: "WRONG_SPEC", label: "Tidak Sesuai Spesifikasi" },
  { value: "EXCESS", label: "Kelebihan Kirim" },
  { value: "OTHER", label: "Lainnya" },
] as const;

interface ReturnLine {
  goodsReceiptItemId: string;
  barangId: string;
  barangNama: string;
  barangKode: string;
  receivedQuantity: number;
  returnNow: number;
  notes: string;
}

export function GoodsReturnCreateClient({ grnId }: { grnId: string | null }) {
  const router = useRouter();
  const [selectedGrnId, setSelectedGrnId] = useState<string>(grnId ?? "");
  const [grn, setGrn] = useState<GrnDetail | null>(null);
  const [reason, setReason] =
    useState<(typeof REASON_OPTIONS)[number]["value"]>("DAMAGED");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedGrnId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/procurement/goods-receipts/${selectedGrnId}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).error || "Gagal memuat GRN");
        }
        const json = await res.json();
        if (cancelled) return;
        const detail = json.data as GrnDetail;
        setGrn(detail);
        setLines(
          detail.items.map((it) => ({
            goodsReceiptItemId: it.id,
            barangId: it.barangId,
            barangNama: it.barangNama ?? "—",
            barangKode: it.barangKode ?? "",
            receivedQuantity: it.quantity,
            returnNow: 0,
            notes: "",
          })),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat GRN");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGrnId]);

  const handleGrnIdChange = (newGrnId: string) => {
    setSelectedGrnId(newGrnId);
    if (!newGrnId) {
      setGrn(null);
      setLines([]);
    }
  };

  const totalReturn = useMemo(
    () => lines.reduce((sum, line) => sum + line.returnNow, 0),
    [lines],
  );

  const updateLine = (index: number, patch: Partial<ReturnLine>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrnId) {
      toast.error("GRN wajib dipilih");
      return;
    }
    const itemsToSend = lines.filter((line) => line.returnNow > 0);
    if (itemsToSend.length === 0) {
      toast.error("Isi minimal satu quantity > 0");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/procurement/goods-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsReceiptId: selectedGrnId,
          reason,
          notes: notes || null,
          fotoBukti: [],
          items: itemsToSend.map((line) => ({
            goodsReceiptItemId: line.goodsReceiptItemId,
            barangId: line.barangId,
            quantity: line.returnNow,
            notes: line.notes || null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat RTV");
      }
      toast.success(json.message || "RTV berhasil dibuat");
      router.push(`/admin/procurement/goods-returns/${json.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat RTV");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProcurementPageShell
      title="Buat Retur Vendor"
      backHref="/admin/procurement/goods-returns"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <fieldset className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-900 shadow-sm">
          <legend className="px-2 text-sm font-medium text-gray-700">
            Header
          </legend>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goods Receipt (GRN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={selectedGrnId}
                onChange={(e) => handleGrnIdChange(e.target.value)}
                placeholder="Tempel ID GRN atau buka dari halaman GRN"
                required
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-100"
              />
              {grn && (
                <p className="mt-1 text-xs text-gray-500">
                  GRN <span className="font-mono">{grn.grnNumber}</span>
                  {grn.poNumber && (
                    <>
                      {" "}
                      · PO <span className="font-mono">{grn.poNumber}</span>
                    </>
                  )}
                  {grn.gudangNama && <> · Gudang {grn.gudangNama}</>}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alasan Retur <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value as (typeof REASON_OPTIONS)[number]["value"],
                  )
                }
                required
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-900 shadow-sm">
          <legend className="px-2 text-sm font-medium text-gray-700">
            Item Diretur
          </legend>
          {!selectedGrnId && (
            <p className="text-sm text-gray-500 py-4 text-center">
              Pilih GRN untuk melihat item yang bisa diretur.
            </p>
          )}
          {selectedGrnId && loading && (
            <p className="text-sm text-gray-500 py-4 text-center">
              Memuat GRN...
            </p>
          )}
          {selectedGrnId && !loading && lines.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">
              GRN tidak punya item.
            </p>
          )}
          {selectedGrnId && !loading && lines.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Barang</th>
                  <th className="px-2 py-2 font-medium text-right">Diterima</th>
                  <th className="px-2 py-2 font-medium text-right">
                    Diretur Sekarang
                  </th>
                  <th className="px-2 py-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.goodsReceiptItemId}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium">{line.barangNama}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {line.barangKode}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {line.receivedQuantity}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={line.receivedQuantity}
                        value={line.returnNow}
                        onChange={(e) =>
                          updateLine(idx, {
                            returnNow: Math.min(
                              line.receivedQuantity,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            ),
                          })
                        }
                        className="w-20 px-2 py-1 border border-gray-100 dark:border-gray-700 rounded text-right bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={line.notes}
                        onChange={(e) =>
                          updateLine(idx, { notes: e.target.value })
                        }
                        placeholder="opsional"
                        maxLength={500}
                        className="w-full px-2 py-1 border border-gray-100 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </fieldset>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-600">
            Total qty diretur:{" "}
            <span className="font-semibold">{totalReturn}</span>
          </span>
          <div className="flex gap-3">
            <Link
              href="/admin/procurement/goods-returns"
              className="px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Batal
            </Link>
            <Button type="submit" disabled={submitting || totalReturn === 0}>
              {submitting ? "Menyimpan..." : "Kirim Retur ke Vendor"}
            </Button>
          </div>
        </div>
      </form>
    </ProcurementPageShell>
  );
}
