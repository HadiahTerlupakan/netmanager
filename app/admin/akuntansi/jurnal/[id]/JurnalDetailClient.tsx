"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "react-hot-toast";
import {
  HiOutlineDocumentText,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowLeft,
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

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  POSTED: {
    label: "Posted",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  REVERSED: {
    label: "Reversed",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
  DRAFT: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-700 dark:text-gray-300",
  },
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
      toast.success("Journal berhasil di-reverse");
      setShowReverse(false);
      setReason("");
      fetchJournal();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal reverse journal");
    }
    setReversing(false);
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Memuat...
        </p>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Journal tidak ditemukan
        </p>
      </div>
    );
  }

  const totalDebit = journal.lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const totalCredit = journal.lines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const statusCfg = STATUS_CONFIG[journal.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineDocumentText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            {journal.entryNumber}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {format(new Date(journal.entryDate), "dd MMMM yyyy", {
              locale: localeId,
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${statusCfg.bg} ${statusCfg.text}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Sumber
          </p>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {journal.source}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Debit
          </p>
          <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(totalDebit)}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Kredit
          </p>
          <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(totalCredit)}
          </h3>
        </div>
        {journal.sourceRefType && (
          <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Referensi
            </p>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {journal.sourceRefType}: {journal.sourceRefId}
            </h3>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Deskripsi
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {journal.description}
        </p>
      </div>

      {/* Journal Lines Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Akun
              </th>
              <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Debit
              </th>
              <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Kredit
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900 dark:text-white">
                  {line.coaId}
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {line.side === "DEBIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {line.side === "CREDIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-sm italic">
                  {line.description || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reverse Section */}
      {journal.status === "POSTED" && canReverse && (
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          {!showReverse ? (
            <button
              onClick={() => setShowReverse(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm"
            >
              <HiOutlineArrowUturnLeft className="w-4 h-4" />
              Reverse Journal
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                Alasan Reversal
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Jelaskan alasan reversal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReverse}
                  disabled={!reason.trim() || reversing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {reversing ? "Memproses..." : "Konfirmasi Reverse"}
                </button>
                <button
                  onClick={() => setShowReverse(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
      >
        <HiOutlineArrowLeft className="w-4 h-4" />
        Kembali
      </button>
    </div>
  );
}
