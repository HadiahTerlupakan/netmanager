"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Recon {
  id: string;
  coaId: string;
  statementDate: string;
  statementBalance: string;
  status: string;
}

export function RekonsiliasiListClient() {
  const router = useRouter();
  const [items, setItems] = useState<Recon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounting/reconciliation");
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
    }
    setLoading(false);
  }, []);

  const _hasFetched = useRef(false);
  useEffect(() => {
    if (_hasFetched.current) return;
    _hasFetched.current = true;
    fetchData();
  }, []);

  if (loading) return <div className="p-4">Memuat...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bank Reconciliation</h1>
      </div>

      <div className="grid gap-3">
        {items.map((r) => (
          <div
            key={r.id}
            className="flex cursor-pointer items-center justify-between rounded border p-4 hover:bg-gray-50"
            onClick={() => router.push(`/admin/akuntansi/rekonsiliasi/${r.id}`)}
          >
            <div>
              <div className="font-medium">
                {new Date(r.statementDate).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="text-sm text-gray-500">
                Saldo Statement: Rp{" "}
                {Number(r.statementBalance).toLocaleString("id-ID")}
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
            >
              {r.status}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-gray-500">
            Belum ada sesi rekonsiliasi
          </p>
        )}
      </div>
    </div>
  );
}
