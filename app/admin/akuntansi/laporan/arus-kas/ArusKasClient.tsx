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
  operating: Section;
  investing: Section;
  financing: Section;
  netChange: string;
  openingCash: string;
  closingCash: string;
}

export function ArusKasClient() {
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
      `/api/admin/accounting/reports/cash-flow?from=${from}&to=${to}`,
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
        <span>Subtotal</span>
        <span>{formatCurrency(Number(section.subtotal))}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Laporan Arus Kas</h1>
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
        <div className="max-w-lg space-y-4 rounded border p-4">
          {renderSection(report.operating)}
          {renderSection(report.investing)}
          {renderSection(report.financing)}
          <div className="space-y-1 border-t-2 pt-2 text-sm">
            <div className="flex justify-between">
              <span>Perubahan Kas Bersih</span>
              <span className="font-bold">
                {formatCurrency(Number(report.netChange))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kas Awal</span>
              <span>{formatCurrency(Number(report.openingCash))}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Kas Akhir</span>
              <span>{formatCurrency(Number(report.closingCash))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
