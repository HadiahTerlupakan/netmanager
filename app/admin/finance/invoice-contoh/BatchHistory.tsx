"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/hooks/useApi";
import type { ZipPart } from "@/modules/sample-invoice";
import { downloadParts } from "./download-parts";

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
    <div className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Riwayat</h2>
        <select
          className="ml-auto rounded border px-2 py-1 text-sm dark:bg-gray-900"
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
      {isLoading && <p className="text-sm text-gray-500">Memuat…</p>}
      {data?.items.length === 0 && (
        <p className="text-sm text-gray-500">Belum ada riwayat.</p>
      )}
      <ul className="divide-y dark:divide-gray-700">
        {data?.items.map((batch) => (
          <li key={batch.id} className="space-y-2 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">{batch.mitraName}</span>
              <span>
                {batch.fromMonth} s/d {batch.toMonth}
              </span>
              <span>
                {batch.customerCount.toLocaleString("id-ID")} pelanggan,{" "}
                {batch.invoiceCount.toLocaleString("id-ID")} PDF
              </span>
              <span className="text-gray-500">
                {batch.createdByName},{" "}
                {new Date(batch.createdAt).toLocaleString("id-ID")}
              </span>
              <span className="ml-auto flex gap-3">
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => showParts(batch.id)}
                >
                  Unduh
                </button>
                {canDelete &&
                  (confirmId === batch.id ? (
                    <>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => remove(batch.id)}
                      >
                        Ya, hapus
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => setConfirmId(batch.id)}
                    >
                      Hapus
                    </button>
                  ))}
              </span>
            </div>
            {parts[batch.id] && (
              <div className="flex flex-wrap gap-2">
                {parts[batch.id].map((part) => (
                  <button
                    key={part.key}
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={() => downloadParts(batch.id, [part])}
                  >
                    {part.label} (
                    {part.invoiceNumbers.length.toLocaleString("id-ID")} PDF)
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
