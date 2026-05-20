"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  HiOutlinePencilSquare,
  HiPlus,
  HiOutlineTrash,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface JournalLine {
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description: string;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
}

export function ManualJournalClient() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { coaId: "", side: "DEBIT", amount: "", description: "" },
    { coaId: "", side: "CREDIT", amount: "", description: "" },
  ]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetch("/api/admin/accounting/coa?isActive=true")
      .then((r) => r.json())
      .then((data) => setCoaOptions(data.data || []));
  }, []);

  const totalDebit = lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const totalCredit = lines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const addLine = () => {
    setLines([
      ...lines,
      { coaId: "", side: "DEBIT", amount: "", description: "" },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: string) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async () => {
    if (!entryDate || !description || !isBalanced) return;

    setSubmitting(true);
    const res = await fetch("/api/admin/accounting/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryDate,
        description,
        lines: lines.map((l) => ({
          coaId: l.coaId,
          side: l.side,
          amount: l.amount,
          description: l.description || null,
        })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      toast.success("Jurnal berhasil dibuat");
      router.push(`/admin/akuntansi/jurnal/${data.data.id}`);
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal membuat jurnal");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlinePencilSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Buat Jurnal Manual
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Buat entri jurnal manual dengan debit dan kredit yang seimbang
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Tanggal
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Deskripsi
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="Keterangan jurnal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Journal Lines */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">
            Baris Jurnal
          </h2>
          <button
            onClick={addLine}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          >
            <HiPlus className="w-4 h-4" />
            Tambah Baris
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Akun
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  D/K
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Keterangan
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <select
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      value={line.coaId}
                      onChange={(e) => updateLine(idx, "coaId", e.target.value)}
                    >
                      <option value="">Pilih akun...</option>
                      {coaOptions.map((coa) => (
                        <option key={coa.id} value={coa.id}>
                          {coa.code} — {coa.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      value={line.side}
                      onChange={(e) => updateLine(idx, "side", e.target.value)}
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Kredit</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-right text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                      value={line.amount}
                      onChange={(e) =>
                        updateLine(idx, "amount", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Opsional"
                      value={line.description}
                      onChange={(e) =>
                        updateLine(idx, "description", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-30"
                      disabled={lines.length <= 2}
                      onClick={() => removeLine(idx)}
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Debit:{" "}
              <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">
                {formatCurrency(totalDebit)}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Kredit:{" "}
              <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalCredit)}
              </span>
            </div>
          </div>
          <div>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <HiOutlineCheckCircle className="w-4 h-4" />
                Balance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <HiOutlineExclamationTriangle className="w-4 h-4" />
                Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <HiOutlineArrowLeft className="w-4 h-4" />
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={!entryDate || !description || !isBalanced || submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Menyimpan..." : "Simpan Jurnal"}
        </button>
      </div>
    </div>
  );
}
