"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  startDate: string;
  endDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-800",
  CLOSING: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-red-100 text-red-800",
  REOPENED: "bg-blue-100 text-blue-800",
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function PeriodeClient() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounting/period");
    if (res.ok) {
      const data = await res.json();
      setPeriods(data.data || []);
    }
    setLoading(false);
  }, []);

  useState(() => {
    fetchData();
  });

  const handleClose = async (id: string) => {
    if (
      !confirm(
        "Tutup buku periode ini? Jurnal tidak bisa ditambah setelah ditutup.",
      )
    )
      return;
    const res = await fetch(`/api/admin/accounting/period/${id}/close`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Periode berhasil ditutup");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal tutup buku");
    }
  };

  const handleReopen = async (id: string) => {
    if (!confirm("Buka kembali periode ini?")) return;
    const res = await fetch(`/api/admin/accounting/period/${id}/reopen`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Periode dibuka kembali");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal membuka periode");
    }
  };

  if (loading) return <div className="p-4">Memuat...</div>;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Periode Akuntansi</h1>

      <div className="grid gap-3">
        {periods.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded border p-4"
          >
            <div>
              <div className="font-medium">
                {MONTHS[p.month - 1]} {p.year}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(p.startDate).toLocaleDateString("id-ID")} —{" "}
                {new Date(p.endDate).toLocaleDateString("id-ID")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || ""}`}
              >
                {p.status}
              </span>
              {(p.status === "OPEN" || p.status === "REOPENED") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() => handleClose(p.id)}
                >
                  Tutup Buku
                </Button>
              )}
              {p.status === "CLOSED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReopen(p.id)}
                >
                  Buka Kembali
                </Button>
              )}
            </div>
          </div>
        ))}
        {periods.length === 0 && (
          <p className="text-center text-gray-500">
            Belum ada periode. Periode akan dibuat otomatis saat jurnal pertama
            di-post.
          </p>
        )}
      </div>
    </div>
  );
}
