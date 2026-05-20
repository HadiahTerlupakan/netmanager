"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface TrialBalanceRow {
  coaCode: string;
  coaName: string;
  coaType: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

interface Report {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export function TrialBalanceClient() {
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/trial-balance?asOfDate=${asOfDate}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Trial Balance</h1>
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
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama Akun</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.coaCode} className="border-b">
                  <td className="px-3 py-2 font-mono">{r.coaCode}</td>
                  <td className="px-3 py-2">{r.coaName}</td>
                  <td className="px-3 py-2">{r.coaType}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(Number(r.totalDebit))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(Number(r.totalCredit))}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(Number(r.balance))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td colSpan={3} className="px-3 py-2">
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(Number(report.totalDebit))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(Number(report.totalCredit))}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={
                      report.balanced ? "text-green-600" : "text-red-600"
                    }
                  >
                    {report.balanced ? "✓ Balance" : "✗ Tidak Balance"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
