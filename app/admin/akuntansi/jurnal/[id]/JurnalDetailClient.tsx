"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "react-hot-toast";
import {
  HiOutlineArrowUturnLeft,
  HiOutlineDocumentText,
} from "react-icons/hi2";

import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";

interface JournalLine {
  id: string;
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  lineOrder: number;
}

interface JournalDetail {
  id: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  sourceRefType: string | null;
  sourceRefId: string | null;
  description: string;
  status: string;
  reversalOfId: string | null;
  postedAt: string | null;
  postedBy: string | null;
  lines: JournalLine[];
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  POSTED: "Terposting",
  REVERSED: "Dibalik",
  DRAFT: "Draf",
};

const STATUS_COLORS: Record<string, string> = {
  POSTED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REVERSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function JurnalDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canReverse = hasPermission("journal:create");

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReverse, setShowReverse] = useState(false);
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const fetchJournal = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/accounting/journal/${id}`);
    if (res.ok) {
      const data = await res.json();
      setJournal(data.data);
    }
    setLoading(false);
  }, [id]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchJournal();
  }, [fetchJournal]);

  const handleReverse = async () => {
    if (!reason.trim()) return;
    setReversing(true);
    const res = await fetch(`/api/admin/accounting/journal/${id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast.success("Jurnal berhasil dibalik");
      setShowReverse(false);
      setReason("");
      fetchJournal();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal membalik jurnal");
    }
    setReversing(false);
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Memuat...</span>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">
          Jurnal tidak ditemukan
        </span>
      </div>
    );
  }

  const totalDebit = journal.lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const totalCredit = journal.lines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shrink-0">
            <HiOutlineDocumentText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {journal.entryNumber}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {format(new Date(journal.entryDate), "dd MMMM yyyy", {
                locale: localeId,
              })}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${STATUS_COLORS[journal.status] || ""}`}
        >
          {STATUS_LABELS[journal.status] ?? journal.status}
        </span>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Sumber
          </p>
          <p className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 truncate">
            {journal.source}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Debit
          </p>
          <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatCurrency(totalDebit)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Kredit
          </p>
          <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">
            {formatCurrency(totalCredit)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Referensi
          </p>
          <p className="text-xl font-black font-mono text-gray-700 dark:text-gray-300 truncate">
            {journal.sourceRefType
              ? `${journal.sourceRefType}: ${journal.sourceRefId}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Deskripsi
        </p>
        <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
          {journal.description}
        </p>
      </div>

      {/* Journal Lines Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Baris Jurnal
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Akun
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Debit
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Kredit
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {journal.lines.map((line) => (
              <tr
                key={line.id}
                className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-white">
                  {line.coaId}
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                  {line.side === "DEBIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                  {line.side === "CREDIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {line.description || "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
              <td className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total
              </td>
              <td className="px-4 py-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(totalDebit)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-black text-green-600 dark:text-green-400">
                {formatCurrency(totalCredit)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Reverse Section */}
      {journal.status === "POSTED" && canReverse && (
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">
            Balik Jurnal
          </p>
          {!showReverse ? (
            <button
              onClick={() => setShowReverse(true)}
              className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-2"
            >
              <HiOutlineArrowUturnLeft className="h-4 w-4" />
              Balik Jurnal
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Alasan Pembalikan
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                placeholder="Jelaskan alasan pembalikan jurnal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleReverse}
                  disabled={!reason.trim() || reversing}
                >
                  {reversing ? "Memproses..." : "Konfirmasi Pembalikan"}
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                  onClick={() => setShowReverse(false)}
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Back Button */}
      <div>
        <button
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-700 dark:text-gray-300"
          onClick={() => router.back()}
        >
          ← Kembali
        </button>
      </div>
    </div>
  );
}
