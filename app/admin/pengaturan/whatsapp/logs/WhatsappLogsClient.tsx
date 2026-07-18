"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineDocumentText,
} from "react-icons/hi2";
import {
  TablePaginationFooter,
  type PaginationState,
} from "@/app/admin/notifications/_components/TablePaginationFooter";
import {
  TableEmptyRow,
  TableLoadingRow,
} from "@/app/admin/notifications/_components/TableStateRows";

type WhatsAppStatus = "pending" | "sent" | "failed" | "delivered" | "read";

interface WhatsAppAccount {
  id: string;
  name: string;
  phone: string;
}

interface WhatsAppMessageItem {
  id: string;
  phone: string;
  message: string | null;
  status: WhatsAppStatus;
  error: string | null;
  messageId: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  account: { id: string; name: string; phone: string; provider: string } | null;
}

interface WhatsAppMessageDetail extends WhatsAppMessageItem {
  fileUrl: string | null;
  response: Record<string, unknown> | null;
  account: {
    id: string;
    name: string;
    phone: string;
    provider: string;
    accountType: string;
  } | null;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  delivered: number;
  read: number;
}

const STATUS_BADGE: Record<WhatsAppStatus, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delivered: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  read: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABEL: Record<WhatsAppStatus, string> = {
  pending: "Pending",
  sent: "Terkirim",
  delivered: "Diterima",
  read: "Dibaca",
  failed: "Gagal",
};

/** Halaman log pengiriman WhatsApp + statistik + detail per pesan. */
export default function WhatsappLogsClient() {
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<Stats>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    delivered: 0,
    read: 0,
  });
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selected, setSelected] = useState<WhatsAppMessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [phoneSearch, setPhoneSearch] = useState<string>("");
  const [phoneInput, setPhoneInput] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (statusFilter) params.set("status", statusFilter);
      if (accountFilter) params.set("accountId", accountFilter);
      if (phoneSearch) params.set("phone", phoneSearch);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      return params;
    },
    [statusFilter, accountFilter, phoneSearch, startDate, endDate],
  );

  const fetchAll = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQuery(page);
        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/admin/whatsapp/messages?${qs}`),
          fetch(`/api/admin/whatsapp/stats?${qs}`),
        ]);
        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (listJson.success) {
          setMessages(listJson.data.items);
          setPagination(listJson.data.pagination);
        }
        if (statsJson.success) {
          setStats(statsJson.data);
        }
      } catch (err) {
        setError("Gagal memuat log WhatsApp");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchAll(1);
  }, [fetchAll]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/whatsapp/accounts");
        const json = await res.json();
        if (mounted && json.success) setAccounts(json.data ?? []);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/messages/${id}`);
      const json = await res.json();
      if (json.success) setSelected(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  function handleRowClick(id: string) {
    void openDetail(id);
  }

  function resetFilters() {
    setStatusFilter("");
    setAccountFilter("");
    setPhoneSearch("");
    setPhoneInput("");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="p-6 space-y-4 min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineChatBubbleLeftRight className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Log WhatsApp
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Riwayat pengiriman WhatsApp — cek yang berhasil, pending, atau gagal
          </p>
        </div>
        <Link
          href="/admin/pengaturan/whatsapp"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Kembali ke Pengaturan WhatsApp
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard
          label="Total Pesan"
          value={stats.total}
          icon={
            <HiOutlineDocumentText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          }
          tint="indigo"
        />
        <StatCard
          label="Terkirim"
          value={stats.sent}
          icon={
            <HiOutlineCheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          }
          tint="blue"
        />
        <StatCard
          label="Diterima"
          value={stats.delivered}
          icon={
            <HiOutlineCheckCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          }
          tint="cyan"
        />
        <StatCard
          label="Dibaca"
          value={stats.read}
          icon={
            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          }
          tint="green"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={
            <HiOutlineClock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          }
          tint="yellow"
        />
        <StatCard
          label="Gagal"
          value={stats.failed}
          icon={
            <HiOutlineXCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          }
          tint="red"
        />
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <FilterField label="Status">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p: PaginationState) => ({ ...p, page: 1 }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua</option>
            <option value="sent">Terkirim</option>
            <option value="delivered">Diterima</option>
            <option value="read">Dibaca</option>
            <option value="pending">Pending</option>
            <option value="failed">Gagal</option>
          </select>
        </FilterField>

        <FilterField label="Akun">
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPagination((p: PaginationState) => ({ ...p, page: 1 }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.phone})
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Dari Tanggal">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPagination((p: PaginationState) => ({ ...p, page: 1 }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </FilterField>

        <FilterField label="Sampai Tanggal">
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPagination((p: PaginationState) => ({ ...p, page: 1 }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </FilterField>

        <div className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Cari nomor tujuan..."
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPhoneSearch(phoneInput);
                setPagination((p: PaginationState) => ({ ...p, page: 1 }));
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => {
              setPhoneSearch(phoneInput);
              setPagination((p: PaginationState) => ({ ...p, page: 1 }));
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Cari
          </button>
          <button
            type="button"
            onClick={() => fetchAll(pagination.page)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Reset filter"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Tujuan
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Akun
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Pesan
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableLoadingRow colSpan={6} />
            ) : messages.length === 0 ? (
              <TableEmptyRow
                colSpan={6}
                message="Tidak ada pesan ditemukan untuk filter ini"
              />
            ) : (
              messages.map((msg) => (
                <tr
                  key={msg.id}
                  onClick={() => handleRowClick(msg.id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {msg.phone}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {msg.account?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[280px] truncate">
                    {msg.message ?? "(file)"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[msg.status]}`}
                    >
                      {STATUS_LABEL[msg.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-600 dark:text-red-400 max-w-[220px] truncate">
                    {msg.error ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePaginationFooter
        pagination={pagination}
        loading={loading}
        onPageChange={(p) => fetchAll(p)}
      />

      {selected && (
        <DetailModal
          detail={selected}
          loading={loadingDetail}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

const TINT_CLASSES: Record<string, string> = {
  indigo:
    "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30",
  blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-900/30",
  green:
    "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30",
  yellow:
    "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30",
  red: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30",
};

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${TINT_CLASSES[tint] ?? TINT_CLASSES.indigo}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/60 dark:bg-black/20">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: WhatsAppMessageDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detail Pesan WhatsApp
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        {loading || !detail ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Memuat...
          </div>
        ) : (
          <div className="p-4 space-y-3 text-sm">
            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[detail.status]}`}
                >
                  {STATUS_LABEL[detail.status]}
                </span>
              }
            />
            <DetailRow label="Tujuan" value={detail.phone} />
            <DetailRow
              label="Akun"
              value={
                detail.account
                  ? `${detail.account.name} (${detail.account.phone}) · ${detail.account.provider}`
                  : "-"
              }
            />
            <DetailRow
              label="Tipe Akun"
              value={
                detail.account?.accountType === "INTERNAL"
                  ? "Internal"
                  : "Customer"
              }
            />
            <DetailRow
              label="Dibuat"
              value={new Date(detail.createdAt).toLocaleString("id-ID")}
            />
            <DetailRow
              label="Terkirim"
              value={
                detail.sentAt
                  ? new Date(detail.sentAt).toLocaleString("id-ID")
                  : "-"
              }
            />
            <DetailRow
              label="Diterima"
              value={
                detail.deliveredAt
                  ? new Date(detail.deliveredAt).toLocaleString("id-ID")
                  : "-"
              }
            />
            <DetailRow
              label="Dibaca"
              value={
                detail.readAt
                  ? new Date(detail.readAt).toLocaleString("id-ID")
                  : "-"
              }
            />
            <DetailRow label="Message ID" value={detail.messageId ?? "-"} />
            {detail.error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                  Error
                </p>
                <p className="text-red-600 dark:text-red-400 break-words">
                  {detail.error}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Isi Pesan
              </p>
              <pre className="whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-gray-800 dark:text-gray-200 font-sans">
                {detail.message ?? "(file saja)"}
              </pre>
            </div>
            {detail.fileUrl && (
              <DetailRow
                label="File"
                value={
                  <a
                    href={detail.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                  >
                    {detail.fileUrl}
                  </a>
                }
              />
            )}
            {detail.response && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Response Provider
                </p>
                <pre className="whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {JSON.stringify(detail.response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 dark:text-gray-400 w-28 shrink-0">
        {label}
      </span>
      <span className="text-gray-900 dark:text-gray-100 flex-1 break-words">
        {value}
      </span>
    </div>
  );
}
