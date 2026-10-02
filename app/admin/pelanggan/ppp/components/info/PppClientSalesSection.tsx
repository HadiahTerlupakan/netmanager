"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { useApi } from "@/lib/hooks/useApi";

interface SalesPilihan {
  id: string;
  name: string | null;
}

interface SalesPelanggan {
  salesId: string | null;
}

const KELAS_SELECT =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm";
const KETERANGAN = "Sales yang menjual pelanggan ini ikut menindaklanjuti tunggakan pembayaran lewat aplikasi.";

/** Dropdown sales aktif tenant; "" = belum ditentukan. */
function PilihSales({ value, onChange, disabled }: { value: string; onChange: (salesId: string) => void; disabled?: boolean }) {
  const { data: sales = [], isLoading } = useApi<SalesPilihan[]>("/api/pelanggan-ppp/sales-pilihan");
  return (
    <select
      aria-label="Sales penanggung jawab"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={KELAS_SELECT}
    >
      <option value="">{isLoading ? "Memuat sales…" : "— Belum ditentukan —"}</option>
      {sales.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name || "(tanpa nama)"}
        </option>
      ))}
    </select>
  );
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sales penanggung jawab</span>
      {children}
      <p className="text-xs text-gray-500 mt-2">{KETERANGAN}</p>
    </div>
  );
}

/** Form pelanggan baru: nilai ikut dikirim bersama data pelanggan. */
export function PppClientSalesSection({ salesId, onSalesChange }: { salesId?: string; onSalesChange: (salesId?: string) => void }) {
  return (
    <Bingkai>
      <PilihSales value={salesId ?? ""} onChange={(nilai) => onSalesChange(nilai || undefined)} />
    </Bingkai>
  );
}

/** Halaman edit: memuat & langsung menyimpan sales penanggung jawab pelanggan yang ada. */
export function PppClientSalesEditor({ pelangganId }: { pelangganId: string }) {
  const url = `/api/pelanggan-ppp/${pelangganId}/sales`;
  const { data, mutate } = useApi<SalesPelanggan>(url);
  const [isMenyimpan, setIsMenyimpan] = useState(false);

  const simpan = async (salesId: string) => {
    setIsMenyimpan(true);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesId: salesId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || body?.error || "Gagal menyimpan sales");
      await mutate({ salesId: salesId || null });
      toast.success(salesId ? "Sales penanggung jawab disimpan" : "Sales penanggung jawab dilepas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan sales");
    } finally {
      setIsMenyimpan(false);
    }
  };

  return (
    <Bingkai>
      <PilihSales value={data?.salesId ?? ""} onChange={(nilai) => void simpan(nilai)} disabled={isMenyimpan || !data} />
    </Bingkai>
  );
}
