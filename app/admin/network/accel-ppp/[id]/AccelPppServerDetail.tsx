"use client";

import Link from "next/link";
import { useState } from "react";
import AccelPppServerForm from "../AccelPppServerForm";
import {
  accelPppMutations,
  useAccelPppServer,
  useAccelPppSessions,
} from "../hooks";

type Tab = "edit" | "sessions";

export default function AccelPppServerDetail({ id }: { id: string }) {
  const { data, loading, error, refresh } = useAccelPppServer(id);
  const [tab, setTab] = useState<Tab>("sessions");

  if (loading && !data) {
    return <div className="text-sm text-slate-500">Memuat…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Server tidak ditemukan"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{data.name}</h1>
          <p className="text-sm text-slate-500 font-mono">
            {data.ipAddress} · CLI {data.cliHost}:{data.cliPort}
          </p>
        </div>
        <Link
          href="/admin/network/accel-ppp"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Kembali
        </Link>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <TabButton
            active={tab === "sessions"}
            onClick={() => setTab("sessions")}
          >
            Sessions Live
          </TabButton>
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
            Edit
          </TabButton>
        </nav>
      </div>

      {tab === "sessions" && <SessionsTab id={id} />}
      {tab === "edit" && (
        <AccelPppServerForm mode="edit" initial={data} key={data.updatedAt} />
      )}

      {tab === "sessions" && (
        <div className="text-xs text-slate-400">
          Polling tiap 10 detik. Last server status:{" "}
          {data.lastStatusCheck
            ? new Date(data.lastStatusCheck).toLocaleString()
            : "—"}{" "}
          ({data.pingStatus}, {data.userOnline} user online).
        </div>
      )}

      <RefreshButton onClick={refresh} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-slate-500 hover:text-slate-700"
    >
      ↻ Refresh data server
    </button>
  );
}

function SessionsTab({ id }: { id: string }) {
  const { items, loading, error, refresh } = useAccelPppSessions(id);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleKick = async (username: string) => {
    if (!confirm(`Putuskan sesi ${username}?`)) return;
    setBusyUsername(username);
    setActionMsg(null);
    try {
      const result = await accelPppMutations.kick(id, username);
      setActionMsg(
        result.terminated
          ? `Sesi ${username} berhasil diputus.`
          : `Sesi ${username}: ${result.message}`,
      );
      await refresh();
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setBusyUsername(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {actionMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Interface</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Calling SID</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Uptime</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  Memuat sesi…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  Tidak ada sesi aktif.
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr
                key={`${s.ifname}-${s.username}`}
                className="border-t border-slate-100"
              >
                <td className="px-3 py-2 font-medium">{s.username}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.ifname}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.ip}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.callingSid}</td>
                <td className="px-3 py-2">{s.type}</td>
                <td className="px-3 py-2">{s.state}</td>
                <td className="px-3 py-2">{s.uptime}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleKick(s.username)}
                    disabled={busyUsername === s.username}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Kick
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
