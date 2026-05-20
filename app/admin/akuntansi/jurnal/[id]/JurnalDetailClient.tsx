"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { HiOutlineArrowUturnLeft } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
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

export function JurnalDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  const _hasFetched = useRef(false);
  useEffect(() => {
    if (_hasFetched.current) return;
    _hasFetched.current = true;
    fetchJournal();
  }, []);

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

  if (loading) return <div className="p-4">Memuat...</div>;
  if (!journal) return <div className="p-4">Journal tidak ditemukan</div>;

  const totalDebit = journal.lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const statusColors: Record<string, string> = {
    POSTED: "bg-green-100 text-green-800",
    REVERSED: "bg-red-100 text-red-800",
    DRAFT: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{journal.entryNumber}</h1>
          <p className="text-sm text-gray-500">
            {format(new Date(journal.entryDate), "dd MMMM yyyy", {
              locale: localeId,
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[journal.status] || ""}`}
        >
          {journal.status}
        </span>
      </div>

      <div className="rounded border p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Sumber</dt>
            <dd className="font-medium">{journal.source}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Deskripsi</dt>
            <dd className="font-medium">{journal.description}</dd>
          </div>
          {journal.sourceRefType && (
            <div>
              <dt className="text-gray-500">Referensi</dt>
              <dd className="font-medium">
                {journal.sourceRefType}: {journal.sourceRefId}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Total</dt>
            <dd className="font-medium">{formatCurrency(totalDebit)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-2 text-left">Akun</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Kredit</th>
              <th className="px-4 py-2 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {journal.lines.map((line) => (
              <tr key={line.id} className="border-b">
                <td className="px-4 py-2">{line.coaId}</td>
                <td className="px-4 py-2 text-right">
                  {line.side === "DEBIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-4 py-2 text-right">
                  {line.side === "CREDIT"
                    ? formatCurrency(Number(line.amount))
                    : ""}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {line.description || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {journal.status === "POSTED" && (
        <div className="rounded border p-4">
          {!showReverse ? (
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setShowReverse(true)}
            >
              <HiOutlineArrowUturnLeft className="mr-1 h-4 w-4" />
              Reverse Journal
            </Button>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Alasan Reversal
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="Jelaskan alasan reversal..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleReverse}
                  disabled={!reason.trim() || reversing}
                >
                  {reversing ? "Memproses..." : "Konfirmasi Reverse"}
                </Button>
                <Button variant="outline" onClick={() => setShowReverse(false)}>
                  Batal
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Button variant="outline" onClick={() => router.back()}>
        Kembali
      </Button>
    </div>
  );
}
