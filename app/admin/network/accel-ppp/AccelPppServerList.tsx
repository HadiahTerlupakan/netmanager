"use client";

import Link from "next/link";
import { useState } from "react";
import { accelPppMutations, useAccelPppServers } from "./hooks";

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === "online";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        isOnline
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-200 text-slate-600"
      }`}
    >
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
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus server ${name}?`)) return;
    setBusyId(id);
    setActionError(null);
    try {
      await accelPppMutations.remove(id);
      await refresh();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("sesi aktif")) {
        if (
          confirm(
            `${msg}\n\nServer masih punya sesi aktif. Tetap hapus dengan force?`,
          )
        ) {
          try {
            await accelPppMutations.remove(id, true);
            await refresh();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accel-PPP Servers</h1>
          <p className="text-sm text-slate-500">
            Manajemen server PPPoE accel-ppp (mode pure RADIUS).
          </p>
        </div>
        <Link
          href="/admin/network/accel-ppp/new"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Tambah Server
        </Link>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Nama</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">CLI</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">User Online</th>
              <th className="px-3 py-2 text-left">Last Check</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  Memuat…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  Belum ada server accel-ppp.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/admin/network/accel-ppp/${row.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.ipAddress}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.cliHost}:{row.cliPort}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.pingStatus} />
                </td>
                <td className="px-3 py-2 text-right">{row.userOnline}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {row.lastStatusCheck
                    ? new Date(row.lastStatusCheck).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleTest(row.id)}
                    disabled={busyId === row.id}
                    className="mr-2 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id, row.name)}
                    disabled={busyId === row.id}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
