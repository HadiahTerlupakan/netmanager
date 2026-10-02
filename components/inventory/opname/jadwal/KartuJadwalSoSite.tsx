"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineCalendarDays } from "react-icons/hi2";

import { MonthSelect } from "@/components/ui/MonthSelect";
import { useApi } from "@/lib/hooks/useApi";
import {
  formatTanggalSo,
  labelJendela,
  periodeSekarang,
  type JadwalSoSite,
} from "./jadwalSoTypes";

const KELAS_INPUT =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm";

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

function labelBulan(periode: string): string {
  return new Date(`${periode}-01T00:00:00.000Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface KartuJadwalSoSiteProps {
  siteId: string;
  canUbah: boolean;
}

/**
 * Jadwal stock opname satu site: jadwal bawaan "tanggal X–Y setiap bulan",
 * jadwal khusus bulan tertentu, dan saklar pengingat.
 */
export function KartuJadwalSoSite({ siteId, canUbah }: KartuJadwalSoSiteProps) {
  const url = `/api/admin/sites/${siteId}/jadwal-so`;
  const { data, refetch } = useApi<JadwalSoSite>(`${url}?periode=${periodeSekarang()}`);
  const [isMenyimpan, setIsMenyimpan] = useState(false);

  const jalankan = async (aksi: () => Promise<boolean>, pesan: string) => {
    setIsMenyimpan(true);
    try {
      if (await aksi()) {
        toast.success(pesan);
        void refetch();
      }
    } finally {
      setIsMenyimpan(false);
    }
  };

  return (
    <div id="jadwal-so" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HiOutlineCalendarDays className="w-5 h-5 text-gray-500" />
          Jadwal Stock Opname
        </h2>
        {data && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bulan ini: {labelJendela(data.jendela)}
            {data.catatan ? ` — ${data.catatan}` : ""}
          </p>
        )}
      </div>

      {data && canUbah && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormJadwalBawaan
            key={`${data.aturan.isAktif}:${data.aturan.tanggalMulai}:${data.aturan.tanggalSelesai}`}
            jadwal={data}
            isMenyimpan={isMenyimpan}
            onSimpan={(aturan) => jalankan(() => kirim(url, "PUT", aturan), "Jadwal bawaan site disimpan")}
          />
          <FormJadwalKhusus
            jadwal={data}
            isMenyimpan={isMenyimpan}
            onSimpan={(periode, isian) =>
              jalankan(() => kirim(`${url}/${periode}`, "PUT", isian), `Jadwal ${labelBulan(periode)} disimpan`)
            }
            onHapus={(periode) =>
              jalankan(() => kirim(`${url}/${periode}`, "DELETE"), `${labelBulan(periode)} kembali ke jadwal bawaan`)
            }
          />
        </div>
      )}

      {data && !canUbah && data.jadwalKhusus.length > 0 && <DaftarJadwalKhusus jadwal={data} />}
    </div>
  );
}

function FormJadwalBawaan({
  jadwal,
  isMenyimpan,
  onSimpan,
}: {
  jadwal: JadwalSoSite;
  isMenyimpan: boolean;
  onSimpan: (aturan: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number }) => void;
}) {
  const [aturan, setAturan] = useState({
    isAktif: jadwal.aturan.isDiatur ? jadwal.aturan.isAktif : true,
    tanggalMulai: jadwal.aturan.tanggalMulai,
    tanggalSelesai: jadwal.aturan.tanggalSelesai,
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Jadwal setiap bulan</h3>
      {!jadwal.aturan.isDiatur && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Site ini belum punya jadwal; laporan menilai SO sebulan penuh.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Dari tanggal
          <input type="number" min={1} max={31} value={aturan.tanggalMulai}
            onChange={(e) => setAturan({ ...aturan, tanggalMulai: Number(e.target.value) })} className={KELAS_INPUT} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Sampai tanggal
          <input type="number" min={1} max={31} value={aturan.tanggalSelesai}
            onChange={(e) => setAturan({ ...aturan, tanggalSelesai: Number(e.target.value) })} className={KELAS_INPUT} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input type="checkbox" checked={aturan.isAktif}
          onChange={(e) => setAturan({ ...aturan, isAktif: e.target.checked })} />
        Kirim pengingat otomatis ke petugas gudang site ini
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Tanggal yang melebihi akhir bulan otomatis menjadi tanggal terakhir bulan itu.
      </p>
      <button type="button" disabled={isMenyimpan} onClick={() => onSimpan(aturan)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
        Simpan jadwal bawaan
      </button>
    </div>
  );
}

function FormJadwalKhusus({
  jadwal,
  isMenyimpan,
  onSimpan,
  onHapus,
}: {
  jadwal: JadwalSoSite;
  isMenyimpan: boolean;
  onSimpan: (periode: string, isian: { mulai: string; selesai: string; catatan: string }) => void;
  onHapus: (periode: string) => void;
}) {
  const [periode, setPeriode] = useState(periodeSekarang());
  const [isian, setIsian] = useState({ mulai: "", selesai: "", catatan: "" });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Jadwal khusus bulan tertentu</h3>
      <div className="text-xs text-gray-600 dark:text-gray-300">
        Bulan
        <MonthSelect value={periode} onChange={setPeriode} className={KELAS_INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Mulai
          <input type="date" min={`${periode}-01`} max={`${periode}-31`} value={isian.mulai}
            onChange={(e) => setIsian({ ...isian, mulai: e.target.value })} className={KELAS_INPUT} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Selesai
          <input type="date" min={`${periode}-01`} max={`${periode}-31`} value={isian.selesai}
            onChange={(e) => setIsian({ ...isian, selesai: e.target.value })} className={KELAS_INPUT} />
        </label>
      </div>
      <input type="text" maxLength={500} placeholder="Catatan (opsional), mis. dimajukan karena libur" value={isian.catatan}
        onChange={(e) => setIsian({ ...isian, catatan: e.target.value })} className={KELAS_INPUT} />
      <button type="button" disabled={isMenyimpan || !isian.mulai || !isian.selesai}
        onClick={() => onSimpan(periode, isian)}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
        Simpan jadwal {labelBulan(periode)}
      </button>
      <DaftarJadwalKhusus jadwal={jadwal} onHapus={onHapus} isMenyimpan={isMenyimpan} />
    </div>
  );
}

function DaftarJadwalKhusus({
  jadwal,
  onHapus,
  isMenyimpan = false,
}: {
  jadwal: JadwalSoSite;
  onHapus?: (periode: string) => void;
  isMenyimpan?: boolean;
}) {
  if (jadwal.jadwalKhusus.length === 0) return null;
  return (
    <div className="pt-2">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Jadwal khusus tersimpan</p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
        {jadwal.jadwalKhusus.map((item) => (
          <li key={item.periode} className="py-2 flex items-center justify-between gap-2">
            <span className="text-gray-700 dark:text-gray-200">
              {labelBulan(item.periode)}: {formatTanggalSo(item.mulai)} – {formatTanggalSo(item.selesai)}
              {item.catatan ? ` · ${item.catatan}` : ""}
            </span>
            {onHapus && (
              <button type="button" disabled={isMenyimpan} onClick={() => onHapus(item.periode)}
                className="text-xs text-red-600 hover:underline disabled:opacity-50">
                Hapus
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
