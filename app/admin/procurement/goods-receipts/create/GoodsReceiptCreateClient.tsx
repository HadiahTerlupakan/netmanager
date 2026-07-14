"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ProcurementPageShell } from "../../_components/ProcurementPageShell";

interface PurchaseOrderItem {
  id: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  barang: { id: string; nama: string; kode: string } | null;
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  status: string;
  paymentStatus: string;
  supplier: { id: string; name: string } | null;
  items: PurchaseOrderItem[];
  ppnAmount: number | null;
  vendorNpwp: string | null;
  fakturPajakNo: string | null;
  fakturPajakDate: string | null;
}

interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  status: string;
}

interface GudangOption {
  id: string;
  nama: string;
}

interface GoodsReceiptCreateClientProps {
  poId: string | null;
}

interface ReceiveLine {
  purchaseOrderItemId: string;
  barangId: string;
  barangNama: string;
  barangKode: string;
  ordered: number;
  alreadyReceived: number;
  remaining: number;
  unitPrice: number;
  receiveNow: number;
  notes: string;
}

/**
 * Form pembuatan Goods Receipt: pilih PO, isi quantity diterima per item.
 * Quantity per item dibatasi maksimum sisa (`remaining`); validasi ulang
 * ada di service layer juga supaya defense-in-depth.
 */
export function GoodsReceiptCreateClient({
  poId,
}: GoodsReceiptCreateClientProps) {
  const router = useRouter();

  const [selectedPoId, setSelectedPoId] = useState<string>(poId ?? "");
  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null);
  const [poList, setPoList] = useState<PurchaseOrderListItem[]>([]);
  const [gudangs, setGudangs] = useState<GudangOption[]>([]);
  const [gudangId, setGudangId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [poRes, gudangRes] = await Promise.all([
          fetch("/api/admin/procurement/purchase-orders?limit=100"),
          fetch("/api/inventory/gudang?limit=100"),
        ]);
        const poJson = poRes.ok ? await poRes.json() : { data: { items: [] } };
        const gudangJson = gudangRes.ok ? await gudangRes.json() : { data: [] };
        if (cancelled) return;
        const rawList: PurchaseOrderListItem[] =
          poJson?.data?.items ?? poJson?.items ?? poJson?.data ?? [];
        const eligibleStatuses = new Set(["DRAFT", "ORDERED", "PARTIAL"]);
        setPoList(rawList.filter((po) => eligibleStatuses.has(po.status)));
        const gudangList: GudangOption[] = (gudangJson?.data ?? []).map(
          (g: { id: string; nama: string }) => ({
            id: g.id,
            nama: g.nama,
          }),
        );
        setGudangs(gudangList);
        if (gudangList.length > 0 && !gudangId) setGudangId(gudangList[0].id);
      } catch {
        // toast handled per fetch above
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/procurement/purchase-orders/${selectedPoId}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).error || "Gagal memuat PO");
        }
        const json = await res.json();
        if (cancelled) return;
        const detail = json.data as PurchaseOrderDetail;
        setPoDetail(detail);
        setLines(
          detail.items.map((it) => ({
            purchaseOrderItemId: it.id,
            barangId: it.barangId,
            barangNama: it.barang?.nama ?? "—",
            barangKode: it.barang?.kode ?? "",
            ordered: it.quantity,
            alreadyReceived: it.receivedQuantity,
            remaining: Math.max(0, it.quantity - it.receivedQuantity),
            unitPrice: it.unitPrice,
            receiveNow: 0,
            notes: "",
          })),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat PO");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPoId]);

  const handlePoChange = (newPoId: string) => {
    setSelectedPoId(newPoId);
    if (!newPoId) {
      setPoDetail(null);
      setLines([]);
    }
  };

  const totalReceiveNow = useMemo(
    () => lines.reduce((sum, line) => sum + line.receiveNow, 0),
    [lines],
  );

  const updateLine = (index: number, patch: Partial<ReceiveLine>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      toast.error("Pilih Purchase Order terlebih dahulu");
      return;
    }
    if (!gudangId) {
      toast.error("Pilih gudang tujuan");
      return;
    }
    const itemsToSend = lines.filter((line) => line.receiveNow > 0);
    if (itemsToSend.length === 0) {
      toast.error("Isi minimal satu quantity > 0");
      return;
    }
    const overReceive = itemsToSend.find(
      (line) => line.receiveNow > line.remaining,
    );
    if (overReceive) {
      toast.error(
        `Quantity ${overReceive.barangNama} melebihi sisa (${overReceive.remaining})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/procurement/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedPoId,
          gudangId,
          notes: notes || null,
          fotoBukti: [],
          items: itemsToSend.map((line) => ({
            purchaseOrderItemId: line.purchaseOrderItemId,
            barangId: line.barangId,
            quantity: line.receiveNow,
            notes: line.notes || null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat GRN");
      }
      toast.success(json.message || "GRN berhasil dibuat");
      router.push(`/admin/procurement/goods-receipts/${json.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat GRN");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProcurementPageShell
      title="Buat Goods Receipt"
      backHref="/admin/procurement/goods-receipts"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <fieldset className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-900 shadow-sm">
          <legend className="px-2 text-sm font-medium text-gray-700">
            Header
          </legend>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Order <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => handlePoChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— Pilih PO —</option>
                {poList.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} ({po.status})
                  </option>
                ))}
                {poDetail && !poList.some((po) => po.id === poDetail.id) && (
                  <option value={poDetail.id}>
                    {poDetail.poNumber} ({poDetail.status})
                  </option>
                )}
              </select>
              {poDetail && (poDetail.ppnAmount ?? 0) > 0 && (
                <FakturPajakInfo poDetail={poDetail} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gudang Tujuan <span className="text-red-500">*</span>
              </label>
              <select
                value={gudangId}
                onChange={(e) => setGudangId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— Pilih gudang —</option>
                {gudangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
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
            Item Diterima
          </legend>
          {!selectedPoId && (
            <p className="text-sm text-gray-500 py-4 text-center">
              Pilih PO untuk melihat daftar item.
            </p>
          )}
          {selectedPoId && loading && (
            <p className="text-sm text-gray-500 py-4 text-center">
              Memuat data PO...
            </p>
          )}
          {selectedPoId && !loading && lines.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">
              PO ini tidak punya item.
            </p>
          )}
          {selectedPoId && !loading && lines.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Barang</th>
                  <th className="px-2 py-2 font-medium text-right">Order</th>
                  <th className="px-2 py-2 font-medium text-right">
                    Sudah Terima
                  </th>
                  <th className="px-2 py-2 font-medium text-right">Sisa</th>
                  <th className="px-2 py-2 font-medium text-right">
                    Terima Sekarang
                  </th>
                  <th className="px-2 py-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.purchaseOrderItemId}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium">{line.barangNama}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {line.barangKode}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">{line.ordered}</td>
                    <td className="px-2 py-2 text-right">
                      {line.alreadyReceived}
                    </td>
                    <td className="px-2 py-2 text-right font-medium">
                      {line.remaining}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={line.remaining}
                        value={line.receiveNow}
                        onChange={(e) =>
                          updateLine(idx, {
                            receiveNow: Math.min(
                              line.remaining,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            ),
                          })
                        }
                        disabled={line.remaining === 0}
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
            Total qty diterima:{" "}
            <span className="font-semibold">{totalReceiveNow}</span>
          </span>
          <div className="flex gap-3">
            <Link
              href="/admin/procurement/goods-receipts"
              className="px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Batal
            </Link>
            <Button
              type="submit"
              disabled={submitting || totalReceiveNow === 0}
            >
              {submitting ? "Menyimpan..." : "Simpan & Post Stok"}
            </Button>
          </div>
        </div>
      </form>
    </ProcurementPageShell>
  );
}

interface FakturPajakInfoProps {
  poDetail: PurchaseOrderDetail;
}

/**
 * Info box yang menampilkan status faktur pajak PO. Tujuan: ingatkan
 * operator melengkapi `vendorNpwp` / `fakturPajakNo` / `fakturPajakDate`
 * di PO sebelum buat GRN supaya pencatatan PPN Masukan langsung punya
 * metadata DJP. Tanpa data ini PPN tetap di-record, tapi laporan ke
 * Coretax akan kurang field — perlu di-update manual nanti.
 */
function FakturPajakInfo({ poDetail }: FakturPajakInfoProps) {
  const hasFaktur =
    !!poDetail.vendorNpwp &&
    !!poDetail.fakturPajakNo &&
    !!poDetail.fakturPajakDate;

  if (hasFaktur) {
    return (
      <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        ✓ Faktur Pajak: {poDetail.fakturPajakNo} (
        {new Date(poDetail.fakturPajakDate as string).toLocaleDateString(
          "id-ID",
        )}
        ) · NPWP: {poDetail.vendorNpwp}
      </p>
    );
  }

  return (
    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
      ⚠ PO ini belum lengkap data faktur pajak (NPWP / Nomor Faktur / Tanggal).
      PPN Masukan akan dicatat tapi laporan Coretax kurang metadata. Idealnya
      lengkapi di Edit PO sebelum buat GRN.
    </p>
  );
}
