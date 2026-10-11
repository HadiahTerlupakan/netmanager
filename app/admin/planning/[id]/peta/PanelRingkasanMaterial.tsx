"use client";

import { HiOutlineExclamationTriangle } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import {
  terapkanCadanganKabel,
  type KebutuhanMaterialOsp,
} from "@/modules/planning/client";

interface PanelRingkasanMaterialProps {
  rekap: KebutuhanMaterialOsp | undefined;
  sedangMemuat: boolean;
  /** Persentase cadangan yang sedang dipilih perencana (0–100). */
  persenCadangan: number;
  onPersenCadanganChange: (persen: number) => void;
  sedangMenerbitkan: boolean;
  dapatMenerbitkan: boolean;
  onTerbitkan: () => void;
}

const CADANGAN_MINIMAL = 0;
const CADANGAN_MAKSIMAL = 100;

const KELAS_SEL_ANGKA =
  "px-3 py-2 text-right text-gray-900 dark:text-white tabular-nums";
const KELAS_JUDUL_KOLOM =
  "px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400";

/** Meter dengan satu angka desimal; satuan ditulis di judul kolom. */
function formatMeter(meter: number): string {
  return meter.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Membatasi angka yang diketik ke rentang yang diterima server. */
function batasiPersen(mentah: string): number {
  const angka = Number(mentah);
  if (!Number.isFinite(angka)) return CADANGAN_MINIMAL;
  return Math.min(CADANGAN_MAKSIMAL, Math.max(CADANGAN_MINIMAL, angka));
}

/**
 * Rekap kebutuhan material dari peta rencana.
 *
 * Kabel ditampilkan dengan dua angka — panjang terukur dan panjang yang
 * dipesan setelah cadangan — supaya pembaca bisa memisahkan "berapa yang
 * terukur" dari "berapa yang dibeli" tanpa menghitung mundur. Angka pesanan
 * dihitung dengan `terapkanCadanganKabel`, fungsi yang sama yang dipakai
 * server saat menerbitkan, sehingga layar dan item material tidak bisa
 * berbeda.
 */
export function PanelRingkasanMaterial({
  rekap,
  sedangMemuat,
  persenCadangan,
  onPersenCadanganChange,
  sedangMenerbitkan,
  dapatMenerbitkan,
  onTerbitkan,
}: PanelRingkasanMaterialProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Kebutuhan material
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Dihitung dari titik dan jalur di peta. Belum tertulis sebagai item
          sampai tombol di bawah ditekan.
        </p>
      </div>

      <div>
        <label
          className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
          htmlFor="cadangan-kabel-persen"
        >
          Cadangan kabel (%)
        </label>
        <input
          id="cadangan-kabel-persen"
          type="number"
          min={CADANGAN_MINIMAL}
          max={CADANGAN_MAKSIMAL}
          step={1}
          value={persenCadangan}
          onChange={(e) => onPersenCadanganChange(batasiPersen(e.target.value))}
          className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {sedangMemuat && !rekap ? (
        <p className="text-xs text-gray-400">Menghitung kebutuhan material…</p>
      ) : !rekap ? (
        <p className="text-xs text-gray-400">
          Kebutuhan material belum bisa dihitung.
        </p>
      ) : (
        <>
          {rekap.jalurDiabaikan > 0 && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <HiOutlineExclamationTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {rekap.jalurDiabaikan} jalur tidak bisa dihitung panjangnya dan
                tidak ikut dijumlahkan. Kebutuhan kabel di bawah lebih kecil
                dari kenyataan — lengkapi koordinat atau panjang jalur itu
                sebelum memesan.
              </span>
            </p>
          )}

          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Kabel
            </h4>
            {rekap.kabel.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada jalur kabel.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className={KELAS_JUDUL_KOLOM}>Jenis</th>
                    <th className={`${KELAS_JUDUL_KOLOM} text-right`}>
                      Terukur (m)
                    </th>
                    <th className={`${KELAS_JUDUL_KOLOM} text-right`}>
                      Dipesan (m)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rekap.kabel.map((kabel) => (
                    <tr key={kabel.jenisFiber}>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">
                        {kabel.jenisFiber}
                      </td>
                      <td
                        className={KELAS_SEL_ANGKA}
                        data-terukur={kabel.jenisFiber}
                      >
                        {formatMeter(kabel.meterTerukur)}
                      </td>
                      <td
                        className={`${KELAS_SEL_ANGKA} font-medium`}
                        data-dipesan={kabel.jenisFiber}
                      >
                        {formatMeter(
                          terapkanCadanganKabel(
                            kabel.meterTerukur,
                            persenCadangan,
                          ),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Splitter
            </h4>
            {rekap.splitter.length === 0 ? (
              <p className="text-xs text-gray-400">
                Belum ada titik berrasio splitter.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className={KELAS_JUDUL_KOLOM}>Rasio</th>
                    <th className={`${KELAS_JUDUL_KOLOM} text-right`}>
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rekap.splitter.map((splitter) => (
                    <tr key={splitter.rasio}>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">
                        {splitter.rasio}
                      </td>
                      <td className={KELAS_SEL_ANGKA}>{splitter.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Titik ODP</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {rekap.jumlahTitik.odp}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Titik ODC</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {rekap.jumlahTitik.odc}
              </dd>
            </div>
          </dl>
        </>
      )}

      {dapatMenerbitkan && (
        <div>
          <Button
            size="sm"
            loading={sedangMenerbitkan}
            disabled={sedangMenerbitkan}
            onClick={onTerbitkan}
          >
            Perbarui kebutuhan material
          </Button>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Item material bertanda Otomatis akan ditimpa; item yang diketik
            manual tidak tersentuh.
          </p>
        </div>
      )}
    </div>
  );
}
