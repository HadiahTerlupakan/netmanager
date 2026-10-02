"use client";

import { useState } from "react";
import { FiCalendar } from "react-icons/fi";

import {
  formatTanggalSo,
  LABEL_KEADAAN,
  type JadwalSoBulan,
  type KeadaanJendela,
} from "./jadwalSoTypes";

interface PanelJadwalSoProps {
  jadwal: JadwalSoBulan;
  keadaan: KeadaanJendela | undefined;
  canManage: boolean;
  isMenyimpan: boolean;
  onSimpanKhusus: (isian: { mulai: string; selesai: string; catatan: string }) => void;
  onPakaiBawaan: () => void;
  onSimpanAturan: (aturan: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number }) => void;
}

const KELAS_INPUT =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm";

/** Jadwal SO bulan terpilih + pengaturan jadwal khusus & aturan bawaan. */
export function PanelJadwalSo(props: PanelJadwalSoProps) {
  const { jadwal, keadaan, canManage } = props;
  const { jendela } = jadwal;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-4">
      <div className="flex items-start gap-3">
        <FiCalendar className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">Jadwal stock opname bulan ini</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatTanggalSo(jendela.mulai)} – {formatTanggalSo(jendela.selesai)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {jendela.sumber === "KHUSUS" ? "Jadwal khusus bulan ini" : "Mengikuti jadwal bawaan"}
            {keadaan ? ` · ${LABEL_KEADAAN[keadaan]}` : ""}
            {!jadwal.aturan.isAktif ? " · Pengingat otomatis mati" : ""}
          </p>
          {jadwal.catatan && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Catatan: {jadwal.catatan}</p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {/* key: form diisi ulang dari data terbaru saat bulan/jadwal berubah */}
          <FormJadwalKhusus
            key={`${jendela.periode}:${jendela.mulai}:${jendela.selesai}:${jadwal.catatan ?? ""}`}
            {...props}
          />
          <FormAturanBawaan
            key={`${jadwal.aturan.isAktif}:${jadwal.aturan.tanggalMulai}:${jadwal.aturan.tanggalSelesai}`}
            {...props}
          />
        </div>
      )}
    </div>
  );
}

function FormJadwalKhusus({ jadwal, isMenyimpan, onSimpanKhusus, onPakaiBawaan }: PanelJadwalSoProps) {
  const [isian, setIsian] = useState({
    mulai: jadwal.jendela.mulai,
    selesai: jadwal.jendela.selesai,
    catatan: jadwal.catatan ?? "",
  });
  const awalBulan = `${jadwal.jendela.periode}-01`;
  const akhirBulan = `${jadwal.jendela.periode}-31`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ubah jadwal khusus bulan ini</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Mulai
          <input type="date" min={awalBulan} max={akhirBulan} value={isian.mulai}
            onChange={(e) => setIsian({ ...isian, mulai: e.target.value })} className={KELAS_INPUT} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Selesai
          <input type="date" min={awalBulan} max={akhirBulan} value={isian.selesai}
            onChange={(e) => setIsian({ ...isian, selesai: e.target.value })} className={KELAS_INPUT} />
        </label>
      </div>
      <input type="text" placeholder="Catatan (opsional), mis. dimajukan karena libur" value={isian.catatan}
        onChange={(e) => setIsian({ ...isian, catatan: e.target.value })} className={KELAS_INPUT} maxLength={500} />
      <div className="flex gap-2">
        <button type="button" disabled={isMenyimpan} onClick={() => onSimpanKhusus(isian)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
          Simpan jadwal bulan ini
        </button>
        {jadwal.jendela.sumber === "KHUSUS" && (
          <button type="button" disabled={isMenyimpan} onClick={onPakaiBawaan}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg disabled:opacity-50">
            Pakai jadwal bawaan
          </button>
        )}
      </div>
    </div>
  );
}

function FormAturanBawaan({ jadwal, isMenyimpan, onSimpanAturan }: PanelJadwalSoProps) {
  const [aturan, setAturan] = useState(jadwal.aturan);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Jadwal bawaan setiap bulan</h3>
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
        Kirim pengingat otomatis (hari pertama, hari terakhir, dan ringkasan setelah jadwal lewat)
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Tanggal yang melebihi akhir bulan otomatis menjadi tanggal terakhir bulan itu.
      </p>
      <button type="button" disabled={isMenyimpan}
        onClick={() => onSimpanAturan({ isAktif: aturan.isAktif, tanggalMulai: aturan.tanggalMulai, tanggalSelesai: aturan.tanggalSelesai })}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
        Simpan jadwal bawaan
      </button>
    </div>
  );
}
