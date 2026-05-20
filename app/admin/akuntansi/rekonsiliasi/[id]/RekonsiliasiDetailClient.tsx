"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface ReconLine {
  id: string;
  bankRefDate: string;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: string;
}

interface Recon {
  id: string;
  statementDate: string;
  statementBalance: string;
  bookBalance: string;
  reconciledBalance: string;
  status: string;
  lines: ReconLine[];
}

export function RekonsiliasiDetailClient() {
  const { id } = useParams<{ id: string }>();
  const [recon, setRecon] = useState<Recon | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/accounting/reconciliation/${id}`);
    if (res.ok) {
      const data = await res.json();
      setRecon(data.data);
    }
    setLoading(false);
  }, [id]);

  useState(() => {
    fetchData();
  });

  const handleComplete = async () => {
    if (!confirm("Selesaikan rekonsiliasi ini?")) return;
    const res = await fetch(
      `/api/admin/accounting/reconciliation/${id}/complete`,
      { method: "POST" },
    );
    if (res.ok) {
      toast.success("Rekonsiliasi selesai");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal");
    }
  };

  if (loading) return <div className="p-4">Memuat...</div>;
  if (!recon) return <div className="p-4">Tidak ditemukan</div>;

  const matched = recon.lines.filter((l) => l.matchStatus !== "UNMATCHED");
  const unmatched = recon.lines.filter((l) => l.matchStatus === "UNMATCHED");

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Detail Rekonsiliasi</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${recon.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
        >
          {recon.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {matched.length}
          </div>
          <div className="text-sm text-gray-500">Matched</div>
        </div>
        <div className="rounded border p-3 text-center">
          <div className="text-2xl font-bold text-red-600">
            {unmatched.length}
          </div>
          <div className="text-sm text-gray-500">Unmatched</div>
        </div>
        <div className="rounded border p-3 text-center">
          <div className="text-lg font-bold">
            {formatCurrency(Number(recon.statementBalance))}
          </div>
          <div className="text-sm text-gray-500">Saldo Statement</div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Deskripsi</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {recon.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="px-3 py-2">
                {new Date(line.bankRefDate).toLocaleDateString("id-ID")}
              </td>
              <td className="px-3 py-2">{line.bankRefDescription}</td>
              <td className="px-3 py-2 text-right">
                {formatCurrency(Number(line.bankRefAmount))}
              </td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${line.matchStatus === "UNMATCHED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                >
                  {line.matchStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {recon.status === "DRAFT" && (
        <Button onClick={handleComplete}>Selesaikan Reconciliation</Button>
      )}
    </div>
  );
}
