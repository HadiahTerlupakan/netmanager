"use client";

import { useState } from "react";
import { HiOutlineArrowDownTray, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/hooks/useApi";
import type { ZipPart } from "@/modules/sample-invoice";
import { downloadParts } from "./download-parts";
import { cardClass, formatMonthRange, inputClass } from "./ui";

type Batch = {
  id: string;
  mitraName: string;
  createdByName: string;
  createdAt: string;
  customerCount: number;
  invoiceCount: number;
  fromMonth: string;
  toMonth: string;
};

export function BatchHistory({
  mitras,
  canDelete,
  refreshKey,
}: {
  mitras: Array<{ id: string; name: string }>;
  canDelete: boolean;
  refreshKey: number;
}) {
  const { showToast } = useToast();
  const [mitraId, setMitraId] = useState("");
  const [parts, setParts] = useState<Record<string, ZipPart[]>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const query = new URLSearchParams({
    limit: "50",
    ...(mitraId ? { mitraId } : {}),
    r: String(refreshKey),
  });
  const { data, isLoading, mutate } = useApi<{ items: Batch[]; total: number }>(
    `/api/admin/sample-invoices?${query}`,
  );

  async function showParts(id: string) {
    const response = await fetch(`/api/admin/sample-invoices/${id}`);
    const body = await response.json();
    if (!response.ok)
      return showToast("error", body.error ?? "Gagal memuat riwayat");
    const list: ZipPart[] = body.data.parts;
    if (list.length === 1) return downloadParts(id, list);
    setParts((current) => ({ ...current, [id]: list }));
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/sample-invoices/${id}`, {
      method: "DELETE",
    });
    setConfirmId(null);
    if (!response.ok) return showToast("error", "Gagal menghapus riwayat");
    showToast("success", "Riwayat dihapus");
    await mutate();
  }

  return (
    <section className={cardClass}>
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Riwayat generate
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ZIP lama bisa diunduh ulang dengan isi yang sama persis.
          </p>
        </div>
        <div className="w-full sm:ml-auto sm:w-60">
          <select
            aria-label="Filter mitra"
            className={inputClass}
            value={mitraId}
            onChange={(e) => setMitraId(e.target.value)}
          >
            <option value="">Semua mitra</option>
            {mitras.map((mitra) => (
              <option key={mitra.id} value={mitra.id}>
                {mitra.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      {isLoading && <p className="px-5 py-6 text-sm text-gray-500">Memuat…</p>}
      {data?.items.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Belum ada riwayat generate.
        </p>
      )}
      {Boolean(data?.items.length) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Mitra</th>
                <th className="px-3 py-2.5 font-medium">Periode</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  Pelanggan
                </th>
                <th className="px-3 py-2.5 text-right font-medium">PDF</th>
                <th className="px-3 py-2.5 font-medium">Dibuat</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data?.items.map((batch) => (
                <BatchRow
                  key={batch.id}
                  batch={batch}
                  parts={parts[batch.id]}
                  canDelete={canDelete}
                  confirming={confirmId === batch.id}
                  onDownload={() => showParts(batch.id)}
                  onDownloadPart={(part) => downloadParts(batch.id, [part])}
                  onAskDelete={() => setConfirmId(batch.id)}
                  onCancelDelete={() => setConfirmId(null)}
                  onDelete={() => remove(batch.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BatchRow(props: {
  batch: Batch;
  parts?: ZipPart[];
  canDelete: boolean;
  confirming: boolean;
  onDownload: () => void;
  onDownloadPart: (part: ZipPart) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const { batch } = props;
  return (
    <>
      <tr className="align-middle hover:bg-gray-50 dark:hover:bg-gray-900/30">
        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
          {batch.mitraName}
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          {formatMonthRange(batch.fromMonth, batch.toMonth)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          {batch.customerCount.toLocaleString("id-ID")}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          {batch.invoiceCount.toLocaleString("id-ID")}
        </td>
        <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
          <div>{batch.createdByName}</div>
          <div className="text-xs">
            {new Date(batch.createdAt).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </td>
        <td className="px-5 py-3">
          <div className="flex justify-end gap-2">
            {props.confirming ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={props.onDelete}
                >
                  Ya, hapus
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={props.onCancelDelete}
                >
                  Batal
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={props.onDownload}>
                  <HiOutlineArrowDownTray /> Unduh
                </Button>
                {props.canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Hapus riwayat"
                    title="Hapus riwayat"
                    onClick={props.onAskDelete}
                  >
                    <HiOutlineTrash />
                  </Button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {props.parts && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-5 py-3 dark:bg-gray-900/30">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Unduhan dipecah per bagian:
            </p>
            <div className="flex flex-wrap gap-2">
              {props.parts.map((part) => (
                <Button
                  key={part.key}
                  size="sm"
                  variant="outline"
                  onClick={() => props.onDownloadPart(part)}
                >
                  {part.label} ·{" "}
                  {part.invoiceNumbers.length.toLocaleString("id-ID")} PDF
                </Button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
