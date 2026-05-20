"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface Account {
  coaCode: string;
  coaName: string;
  amount: string;
}
interface Section {
  label: string;
  accounts: Account[];
  subtotal: string;
}
interface Report {
  from: string;
  to: string;
  revenue: Section;
  expense: Section;
  netIncome: string;
}

export function LabaRugiClient() {
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/profit-loss?from=${from}&to=${to}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  const renderSection = (section: Section) => (
    <div className="space-y-1">
      <h3 className="font-semibold">{section.label}</h3>
      {section.accounts.map((a) => (
        <div key={a.coaCode} className="flex justify-between pl-4 text-sm">
          <span>
            {a.coaCode} — {a.coaName}
          </span>
          <span>{formatCurrency(Number(a.amount))}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-1 font-medium">
        <span>Subtotal {section.label}</span>
        <span>{formatCurrency(Number(section.subtotal))}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Laporan Laba Rugi</h1>
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm">Dari</label>
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Sampai</label>
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? "Memuat..." : "Tampilkan"}
        </Button>
      </div>
      {report && (
        <div className="max-w-lg space-y-6 rounded border p-4">
          {renderSection(report.revenue)}
          {renderSection(report.expense)}
          <div className="flex justify-between border-t-2 pt-2 text-lg font-bold">
            <span>Laba/Rugi Bersih</span>
            <span
              className={
                Number(report.netIncome) >= 0
                  ? "text-green-700"
                  : "text-red-700"
              }
            >
              {formatCurrency(Number(report.netIncome))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
