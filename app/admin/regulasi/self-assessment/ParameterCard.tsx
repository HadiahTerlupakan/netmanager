import { HiOutlineCheckCircle, HiOutlineXCircle } from "react-icons/hi2";
import {
  MONTH_SHORT_NAMES,
  QUARTER_NAMES,
  dayUnitLabel,
  formatDateTime,
  formatRatio,
  ratioTone,
} from "./self-assessment-format";
import type { ParameterSummary } from "./self-assessment-types";

/** Hasil satu parameter: capaian tahunan, kuartalan, bulanan, per wilayah, dan yang tidak memenuhi. */

function VerdictBadge({ isTargetMet }: { isTargetMet: boolean | null }) {
  if (isTargetMet === null) {
    return (
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        Belum ada data
      </span>
    );
  }
  return isTargetMet ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <HiOutlineCheckCircle className="h-4 w-4" /> Memenuhi standar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
      <HiOutlineXCircle className="h-4 w-4" /> Tidak memenuhi standar
    </span>
  );
}

const TABLE_CLASS = "w-full text-sm";
const HEAD_CELL = "px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400";
const CELL = "px-3 py-2 text-gray-700 dark:text-gray-300";

export function ParameterCard({ parameter }: { parameter: ParameterSummary }) {
  const target = parameter.targetRatio;
  const unit = dayUnitLabel(parameter.dayUnit);

  return (
    <section className="space-y-5 rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {parameter.number}. {parameter.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tolok ukur: {parameter.standardLabel} · Dasar: {parameter.basis}
          </p>
        </div>
        <VerdictBadge isTargetMet={parameter.isTargetMet} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-xs text-gray-500">Capaian 1 tahun</p>
          <p className={`text-2xl font-bold ${ratioTone(parameter.annual.ratio, target)}`}>
            {formatRatio(parameter.annual.ratio)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-xs text-gray-500">Permohonan dinilai</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {parameter.annual.received.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-xs text-gray-500">Memenuhi ≤ {parameter.maxDays} {unit}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {parameter.annual.met.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-xs text-gray-500">Masih dikerjakan (belum dinilai)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {parameter.pendingCount.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {parameter.quarters.map((quarter) => (
          <div key={quarter.quarter} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500">{QUARTER_NAMES[quarter.quarter - 1]}</p>
            <p className={`text-lg font-semibold ${ratioTone(quarter.ratio, target)}`}>
              {formatRatio(quarter.ratio)}
            </p>
            <p className="text-xs text-gray-500">N = {quarter.received.toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className={TABLE_CLASS}>
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className={HEAD_CELL}>Bulan</th>
              {parameter.months.map((month) => (
                <th key={month.month} className={`${HEAD_CELL} text-right`}>
                  {MONTH_SHORT_NAMES[month.month - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <td className={CELL}>Diterima (N)</td>
              {parameter.months.map((month) => (
                <td key={month.month} className={`${CELL} text-right`}>{month.received}</td>
              ))}
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <td className={CELL}>Statistik (S)</td>
              {parameter.months.map((month) => (
                <td key={month.month} className={`${CELL} text-right font-medium ${ratioTone(month.ratio, target)}`}>
                  {formatRatio(month.ratio)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Per kabupaten/kota</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className={TABLE_CLASS}>
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className={HEAD_CELL}>Wilayah</th>
                  <th className={`${HEAD_CELL} text-right`}>N</th>
                  <th className={`${HEAD_CELL} text-right`}>Capaian</th>
                </tr>
              </thead>
              <tbody>
                {parameter.regions.map((region) => (
                  <tr key={region.region} className="border-t border-gray-100 dark:border-gray-700">
                    <td className={CELL}>{region.region}</td>
                    <td className={`${CELL} text-right`}>{region.received.toLocaleString("id-ID")}</td>
                    <td className={`${CELL} text-right font-medium ${ratioTone(region.ratio, target)}`}>
                      {formatRatio(region.ratio)}
                    </td>
                  </tr>
                ))}
                {parameter.regions.length === 0 && (
                  <tr>
                    <td colSpan={3} className={`${CELL} text-center text-gray-500`}>Belum ada permohonan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            Tidak memenuhi standar ({parameter.notMetCount.toLocaleString("id-ID")})
          </h3>
          <div className="max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className={TABLE_CLASS}>
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={HEAD_CELL}>Work order</th>
                  <th className={HEAD_CELL}>Mulai</th>
                  <th className={`${HEAD_CELL} text-right`}>Durasi</th>
                </tr>
              </thead>
              <tbody>
                {parameter.notMetPreview.map((sample) => (
                  <tr key={sample.reference} className="border-t border-gray-100 dark:border-gray-700">
                    <td className={CELL}>
                      <span className="font-medium text-gray-900 dark:text-white">{sample.reference}</span>
                      <span className="block text-xs text-gray-500">
                        {[sample.siteName, sample.finishedAt ? null : "belum selesai"].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className={CELL}>{formatDateTime(sample.startedAt)}</td>
                    <td className={`${CELL} text-right`}>{sample.durationDays} {unit}</td>
                  </tr>
                ))}
                {parameter.notMetPreview.length === 0 && (
                  <tr>
                    <td colSpan={3} className={`${CELL} text-center text-gray-500`}>Tidak ada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {parameter.notMetCount > parameter.notMetPreview.length && (
            <p className="mt-1 text-xs text-gray-500">
              Menampilkan {parameter.notMetPreview.length} terbaru; daftar lengkap ada di berkas Excel.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
