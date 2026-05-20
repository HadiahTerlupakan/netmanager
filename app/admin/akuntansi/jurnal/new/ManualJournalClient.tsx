"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { HiPlus, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
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

  useState(() => {
    fetch("/api/admin/accounting/coa?isActive=true")
      .then((r) => r.json())
      .then((data) => setCoaOptions(data.data || []));
  });

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
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-xl font-bold">Buat Jurnal Manual</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Tanggal</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Deskripsi</label>
          <input
            type="text"
            className="w-full rounded border px-3 py-2"
            placeholder="Keterangan jurnal..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Baris Jurnal</h2>
          <Button variant="outline" size="sm" onClick={addLine}>
            <HiPlus className="mr-1 h-4 w-4" />
            Tambah Baris
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Akun</th>
              <th className="py-2">D/K</th>
              <th className="py-2">Jumlah</th>
              <th className="py-2">Keterangan</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2 pr-2">
                  <select
                    className="w-full rounded border px-2 py-1.5 text-sm"
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
                <td className="py-2 pr-2">
                  <select
                    className="rounded border px-2 py-1.5 text-sm"
                    value={line.side}
                    onChange={(e) => updateLine(idx, "side", e.target.value)}
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Kredit</option>
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    className="w-32 rounded border px-2 py-1.5 text-right text-sm"
                    placeholder="0"
                    value={line.amount}
                    onChange={(e) => updateLine(idx, "amount", e.target.value)}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    className="w-full rounded border px-2 py-1.5 text-sm"
                    placeholder="Opsional"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(idx, "description", e.target.value)
                    }
                  />
                </td>
                <td className="py-2">
                  <button
                    className="text-red-500 hover:text-red-700 disabled:opacity-30"
                    disabled={lines.length <= 2}
                    onClick={() => removeLine(idx)}
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded bg-gray-50 p-4">
        <div className="space-y-1 text-sm">
          <div>
            Total Debit: <strong>{formatCurrency(totalDebit)}</strong>
          </div>
          <div>
            Total Kredit: <strong>{formatCurrency(totalCredit)}</strong>
          </div>
        </div>
        <div className="text-right">
          {isBalanced ? (
            <span className="text-sm font-medium text-green-600">
              ✓ Balance
            </span>
          ) : (
            <span className="text-sm font-medium text-red-600">
              ✗ Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!entryDate || !description || !isBalanced || submitting}
        >
          {submitting ? "Menyimpan..." : "Simpan Jurnal"}
        </Button>
      </div>
    </div>
  );
}
