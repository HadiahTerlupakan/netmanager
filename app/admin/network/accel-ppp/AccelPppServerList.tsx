"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineSignal, HiPencil, HiTrash } from "react-icons/hi2";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import {
  accelPppMutations,
  useAccelPppServers,
  type AccelPppServerListItem,
} from "./hooks";

const formatDateTime = (date: string | null) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StatusPill({ status }: { status: string }) {
  const isOnline = status === "online";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isOnline
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOnline ? "bg-emerald-500" : "bg-gray-400"
        }`}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

export default function AccelPppServerList() {
  const { items, loading, error, refresh } = useAccelPppServers();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await accelPppMutations.testConnection(id);
      refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Hapus server "${name}"?\n\nServer akan dihapus dari aplikasi dan baris NAS-nya akan dilepas dari FreeRADIUS DB. Pelanggan yang sedang dial ke server ini akan ditolak saat re-auth berikutnya.`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await accelPppMutations.remove(id);
      refresh();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("sesi aktif")) {
        if (
          confirm(
            `${msg}\n\n⚠️ PERINGATAN PENTING:\n` +
              `• Force delete TIDAK menutup sesi yang sedang aktif di accel-ppp box.\n` +
              `• Sesi akan terus berjalan sampai pelanggan disconnect manual atau timeout dari NAS.\n` +
              `• Setelah delete, baris NAS dilepas dari RADIUS — Acct-Update dari sesi tersebut akan ditolak.\n\n` +
              `Disarankan: kick semua sesi dulu via tab Sessions Live, baru delete.\n\n` +
              `Tetap force delete sekarang?`,
          )
        ) {
          try {
            await accelPppMutations.remove(id, true);
            refresh();
          } catch (forceErr) {
            setActionError((forceErr as Error).message);
          }
        }
      } else {
        setActionError(msg);
      }
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<AccelPppServerListItem>[] = [
    {
      key: "name",
      header: "Nama",
      priority: "primary",
      render: (row) => (
        <Link
          href={`/admin/network/accel-ppp/${row.id}`}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "ipAddress",
      header: "IP / Hostname",
      priority: "primary",
      render: (row) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {row.ipAddress}
        </span>
      ),
    },
    {
      key: "cliHost",
      header: "CLI",
      priority: "secondary",
      render: (row) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {row.cliHost}:{row.cliPort}
        </span>
      ),
    },
    {
      key: "pingStatus",
      header: "Status",
      priority: "primary",
      render: (row) => <StatusPill status={row.pingStatus} />,
    },
    {
      key: "userOnline",
      header: "Online",
      priority: "secondary",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {row.userOnline}
        </span>
      ),
    },
    {
      key: "lastStatusCheck",
      header: "Cek Terakhir",
      priority: "tertiary",
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDateTime(row.lastStatusCheck)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Accel-PPP Servers
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manajemen server PPPoE accel-ppp (mode pure RADIUS).
          </p>
        </div>
        <Link
          href="/admin/network/accel-ppp/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          <span>+</span>
          <span>Tambah Server</span>
        </Link>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-300">
          INFO:
        </div>
        <ul className="list-inside list-disc space-y-1 text-sm text-blue-800 dark:text-blue-400">
          <li>
            Status server di-cek otomatis tiap menit oleh background monitor via
            CLI <span className="font-mono text-xs">show stat</span>.
          </li>
          <li>
            Sesi PPPoE pelanggan ditrack lewat{" "}
            <span className="font-mono text-xs">radacct.nasipaddress</span>;
            pelanggan bisa dial ke server mana saja (any-server).
          </li>
        </ul>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {actionError}
        </div>
      )}

      <ResponsiveTable<AccelPppServerListItem>
        data={items}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-8">
            <HiOutlineSignal className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Belum ada accel-ppp server. Tambahkan server pertama untuk mulai.
            </p>
          </div>
        }
        loadingMessage="Memuat data server..."
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleTest(row.id)}
              disabled={busyId === row.id}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              title="Test koneksi CLI"
            >
              <HiOutlineSignal className="h-3.5 w-3.5" />
              Test
            </button>
            <Link
              href={`/admin/network/accel-ppp/${row.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              title="Edit / detail"
            >
              <HiPencil className="h-3.5 w-3.5" />
              Detail
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(row.id, row.name)}
              disabled={busyId === row.id}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
              title="Hapus server"
            >
              <HiTrash className="h-3.5 w-3.5" />
              Hapus
            </button>
          </div>
        )}
      />
    </div>
  );
}
