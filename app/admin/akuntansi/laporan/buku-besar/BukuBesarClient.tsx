"use client";

import { useState, useRef, useEffect, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface CoaOption {
  id: string;
  code: string;
  name: string;
}
interface Entry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}
interface Report {
  coaCode: string;
  coaName: string;
  coaType: string;
  normalSide: string;
  from: string;
  to: string;
  openingBalance: string;
  entries: Entry[];
  closingBalance: string;
}

export function BukuBesarClient() {
  const [coaId, setCoaId] = useState("");
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const _hasFetched = useRef(false);
  useEffect(() => {
    if (_hasFetched.current) return;
    _hasFetched.current = true;
    fetch("/api/admin/accounting/coa?isActive=true")
      .then((r) => r.json())
      .then((data) => setCoaOptions(data.data || []));
  }, []);

  const fetchReport = async () => {
    if (!coaId) return;
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/general-ledger?coaId=${coaId}&from=${from}&to=${to}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Buku Besar (General Ledger)</h1>
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm">Akun</label>
          <select
            className="rounded border px-3 py-2"
            value={coaId}
            onChange={(e) => setCoaId(e.target.value)}
          >
            <option value="">Pilih akun...</option>
            {coaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
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
        <Button onClick={fetchReport} disabled={loading || !coaId}>
          {loading ? "Memuat..." : "Tampilkan"}
        </Button>
      </div>
      {report && (
        <>
          <div className="text-sm">
            <strong>
              {report.coaCode} — {report.coaName}
            </strong>{" "}
            ({report.coaType}, Normal: {report.normalSide})
          </div>
          <div className="text-sm">
            Saldo Awal:{" "}
            <strong>{formatCurrency(Number(report.openingBalance))}</strong>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">No. Jurnal</th>
                <th className="px-3 py-2">Deskripsi</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-2">{e.date}</td>
                  <td className="px-3 py-2 font-mono">{e.entryNumber}</td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(e.debit) > 0 ? formatCurrency(Number(e.debit)) : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Number(e.credit) > 0
                      ? formatCurrency(Number(e.credit))
                      : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(Number(e.runningBalance))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-sm">
            Saldo Akhir:{" "}
            <strong>{formatCurrency(Number(report.closingBalance))}</strong>
          </div>
        </>
      )}
    </div>
  );
}
