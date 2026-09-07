"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineDocumentCheck, HiOutlinePlus } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import EndorsementCreateModal from "./EndorsementCreateModal";

/** Daftar surat pengesahan beserta kemajuan tanda tangannya. */

interface EndorsementListItem {
  id: string;
  number: string;
  title: string;
  status: string;
  signerCount: number;
  signedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface ListResponse {
  data?: { items: EndorsementListItem[]; total: number };
  items?: EndorsementListItem[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  SENT: "Menunggu tanda tangan",
  COMPLETED: "Sah",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};

const STATUS_TONE: Record<string, string> = {
  COMPLETED:
    "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  SENT: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  CANCELLED: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  EXPIRED:
    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

const NEUTRAL_TONE =
  "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EndorsementListClient() {
  const { data, error, isLoading, mutate } = useApi<ListResponse>(
    "/api/admin/endorsements?limit=50",
  );
  const [isCreating, setIsCreating] = useState(false);

  const items = data?.data?.items ?? data?.items ?? [];

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat daftar surat pengesahan.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <HiOutlineDocumentCheck className="h-6 w-6" />
            Surat Pengesahan
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Kirim dokumen untuk disahkan lewat tautan privat, hasilnya satu PDF
            beserta tanda tangan.
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5"
        >
          <HiOutlinePlus className="h-4 w-4" />
          Buat surat
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Belum ada surat pengesahan.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Judul</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tanda tangan</th>
                <th className="px-4 py-3">Berlaku sampai</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-700/60"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                    <Link
                      href={`/admin/pengesahan/${item.id}`}
                      className="hover:underline"
                    >
                      {item.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    <Link
                      href={`/admin/pengesahan/${item.id}`}
                      className="hover:underline"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_TONE[item.status] ?? NEUTRAL_TONE
                      }`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {item.signedCount} / {item.signerCount}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {formatDate(item.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreating && (
        <EndorsementCreateModal
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            void mutate();
          }}
        />
      )}
    </div>
  );
}
