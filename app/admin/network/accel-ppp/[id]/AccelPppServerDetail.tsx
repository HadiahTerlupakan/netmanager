"use client";

import Link from "next/link";
import { useState } from "react";
import { HiArrowLeft, HiArrowPath, HiNoSymbol } from "react-icons/hi2";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import AccelPppServerForm from "../AccelPppServerForm";
import {
  accelPppMutations,
  useAccelPppServer,
  useAccelPppSessions,
  type AccelPppSessionItem,
} from "../hooks";

type Tab = "edit" | "sessions";

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

export default function AccelPppServerDetail({ id }: { id: string }) {
  const { data, loading, error, refresh } = useAccelPppServer(id);
  const [tab, setTab] = useState<Tab>("sessions");

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
        Memuat data server…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        {error ?? "Server tidak ditemukan"}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/network/accel-ppp"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Kembali"
          >
            <HiArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.name}
              </h1>
              <StatusPill status={data.pingStatus} />
            </div>
            <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
              {data.ipAddress} · CLI {data.cliHost}:{data.cliPort}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <HiArrowPath className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <SummaryCards
        userOnline={data.userOnline}
        lastStatusCheck={data.lastStatusCheck}
        authPort={data.authPort}
        acctPort={data.acctPort}
      />

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          <TabButton
            active={tab === "sessions"}
            onClick={() => setTab("sessions")}
          >
            Sesi Live
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
    </div>
  );
}

function SummaryCards({
  userOnline,
  lastStatusCheck,
  authPort,
  acctPort,
}: {
  userOnline: number;
  lastStatusCheck: string | null;
  authPort: number;
  acctPort: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard label="User Online" value={String(userOnline)} />
      <SummaryCard
        label="Cek Terakhir"
        value={formatDateTime(lastStatusCheck)}
        mono
      />
      <SummaryCard label="Auth Port" value={String(authPort)} mono />
      <SummaryCard label="Acct Port" value={String(acctPort)} mono />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 text-base font-semibold text-gray-900 dark:text-white ${mono ? "font-mono text-sm" : ""}`}
      >
        {value}
      </div>
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
      className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function SessionsTab({ id }: { id: string }) {
  const { items, loading, error, refresh } = useAccelPppSessions(id);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleKick = async (username: string) => {
    if (
      !confirm(
        `Putuskan sesi pelanggan "${username}"?\n\nServer akan menjalankan "terminate username ${username}" — sesi PPPoE-nya akan terputus dan pelanggan harus dial ulang.`,
      )
    ) {
      return;
    }
    setBusyUsername(username);
    setActionMsg(null);
    try {
      const result = await accelPppMutations.kick(id, username);
      setActionMsg(
        result.terminated
          ? `Sesi ${username} berhasil diputus.`
          : `Sesi ${username}: ${result.message}`,
      );
      refresh();
    } catch (err) {
      setActionMsg((err as Error).message);
    } finally {
      setBusyUsername(null);
    }
  };

  const columns: Column<AccelPppSessionItem>[] = [
    {
      key: "username",
      header: "Username",
      priority: "primary",
      render: (s) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {s.username}
        </span>
      ),
    },
    {
      key: "ifname",
      header: "Interface",
      priority: "secondary",
      render: (s) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {s.ifname}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP Pelanggan",
      priority: "primary",
      render: (s) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {s.ip}
        </span>
      ),
    },
    {
      key: "callingSid",
      header: "Calling SID",
      priority: "tertiary",
      render: (s) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {s.callingSid}
        </span>
      ),
    },
    {
      key: "type",
      header: "Tipe",
      priority: "tertiary",
      render: (s) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {s.type}
        </span>
      ),
    },
    {
      key: "comp",
      header: "Comp",
      priority: "tertiary",
      render: (s) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {s.comp ?? "—"}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      priority: "secondary",
      render: (s) => (
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            s.state === "active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          {s.state}
        </span>
      ),
    },
    {
      key: "uptime",
      header: "Uptime",
      priority: "secondary",
      render: (s) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {s.uptime}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Auto-refresh tiap 10 detik.</span>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <HiArrowPath className="h-3 w-3" />
          Refresh sekarang
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          {actionMsg}
        </div>
      )}

      <ResponsiveTable<AccelPppSessionItem>
        data={items}
        columns={columns}
        keyField="username"
        generateKey={(s) => `${s.ifname}-${s.username}`}
        loading={loading}
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tidak ada sesi PPPoE aktif di server ini.
            </p>
          </div>
        }
        loadingMessage="Memuat sesi…"
        renderActions={(s) => (
          <button
            type="button"
            onClick={() => handleKick(s.username)}
            disabled={busyUsername === s.username}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
            title="Putuskan sesi"
          >
            <HiNoSymbol className="h-3.5 w-3.5" />
            Kick
          </button>
        )}
      />
    </div>
  );
}
