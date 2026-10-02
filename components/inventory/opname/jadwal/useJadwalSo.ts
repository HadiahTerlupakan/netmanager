"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { useApi } from "@/lib/hooks/useApi";
import type { JadwalSoBulan, LaporanKepatuhanSo } from "./jadwalSoTypes";

async function kirim(url: string, method: "PUT" | "DELETE", body?: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return true;
  const data = await res.json().catch(() => ({}));
  toast.error(data.error || data.message || "Gagal menyimpan");
  return false;
}

/** Data & aksi tab Jadwal & Kepatuhan SO untuk satu bulan. */
export function useJadwalSo(periode: string) {
  const [isMenyimpan, setIsMenyimpan] = useState(false);
  const jadwal = useApi<JadwalSoBulan>(`/api/inventory/opname/jadwal?periode=${periode}`);
  const kepatuhan = useApi<LaporanKepatuhanSo>(`/api/inventory/opname/kepatuhan?periode=${periode}`);

  const jalankan = async (aksi: () => Promise<boolean>, pesanSukses: string) => {
    setIsMenyimpan(true);
    try {
      if (await aksi()) {
        toast.success(pesanSukses);
        void jadwal.refetch();
        void kepatuhan.refetch();
      }
    } finally {
      setIsMenyimpan(false);
    }
  };

  return {
    jadwal: jadwal.data,
    kepatuhan: kepatuhan.data,
    isMemuat: jadwal.isLoading || kepatuhan.isLoading,
    isMenyimpan,
    simpanJadwalKhusus: (isian: { mulai: string; selesai: string; catatan: string }) =>
      jalankan(
        () => kirim(`/api/inventory/opname/jadwal/${periode}`, "PUT", isian),
        "Jadwal bulan ini disimpan",
      ),
    pakaiAturanBawaan: () =>
      jalankan(
        () => kirim(`/api/inventory/opname/jadwal/${periode}`, "DELETE"),
        "Bulan ini kembali memakai jadwal bawaan",
      ),
    simpanAturan: (aturan: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number }) =>
      jalankan(() => kirim("/api/inventory/opname/jadwal", "PUT", aturan), "Jadwal bawaan disimpan"),
  };
}
