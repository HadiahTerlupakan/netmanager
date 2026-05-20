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
  asOfDate: string;
  asset: Section;
  liability: Section;
  equity: Section;
  totalAsset: string;
  totalLiabilityEquity: string;
  balanced: boolean;
}

export function NeracaClient() {
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/balance-sheet?asOfDate=${asOfDate}`,
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
        <span>Total {section.label}</span>
        <span>{formatCurrency(Number(section.subtotal))}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Neraca (Balance Sheet)</h1>
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm">Per Tanggal</label>
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? "Memuat..." : "Tampilkan"}
        </Button>
      </div>
      {report && (
        <div className="grid grid-cols-2 gap-6 rounded border p-4">
          <div className="space-y-4">{renderSection(report.asset)}</div>
          <div className="space-y-4">
            {renderSection(report.liability)}
            {renderSection(report.equity)}
          </div>
          <div className="col-span-2 flex justify-between border-t-2 pt-2 font-bold">
            <span>Total Aset: {formatCurrency(Number(report.totalAsset))}</span>
            <span>
              Total L+E: {formatCurrency(Number(report.totalLiabilityEquity))}
            </span>
            <span
              className={report.balanced ? "text-green-600" : "text-red-600"}
            >
              {report.balanced ? "✓ Balance" : "✗ Tidak Balance"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
