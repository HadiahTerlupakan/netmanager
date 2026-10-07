"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HiOutlineArrowDownTray,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { useApi } from "@/lib/hooks/useApi";
import type { LicenseScheme } from "@/modules/regulatory/client";
import { DocumentFormModal } from "./DocumentFormModal";
import { ParameterCard } from "./ParameterCard";
import {
  formatDate,
  isHolidayCalendarIncomplete,
  selectableYears,
} from "./self-assessment-format";
import type { SelfAssessmentSummary } from "./self-assessment-types";

const REPORT_URL = "/api/admin/regulatory/self-assessment";
const SITES_URL = "/api/admin/sites";

const SELECTABLE_YEAR_COUNT = 4;

function DataWarnings({ summary }: { summary: SelfAssessmentSummary }) {
  const { sitesWithoutRegion, lastHolidayDate } = summary.warnings;
  const isHolidayIncomplete = isHolidayCalendarIncomplete(lastHolidayDate);
  if (!sitesWithoutRegion.length && !isHolidayIncomplete) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <p className="flex items-center gap-2 font-medium">
        <HiOutlineExclamationTriangle className="h-5 w-5" /> Lengkapi data agar
        laporan akurat
      </p>
      {sitesWithoutRegion.length > 0 && (
        <p>
          Kabupaten/kota belum diisi untuk site:{" "}
          <strong>{sitesWithoutRegion.join(", ")}</strong>.{" "}
          <Link href="/admin/workorders/sites" className="underline">
            Isi di halaman Site
          </Link>
          .
        </p>
      )}
      {isHolidayIncomplete && (
        <p>
          Hari libur {summary.year}{" "}
          {lastHolidayDate
            ? `baru tercatat sampai ${formatDate(lastHolidayDate)}`
            : "belum dicatat"}{" "}
          — hari kerja pemulihan layanan bisa terhitung lebih banyak.{" "}
          <Link href="/admin/kehadiran/holidays" className="underline">
            Lengkapi hari libur
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function UpcomingParameters({ summary }: { summary: SelfAssessmentSummary }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <HiOutlineClock className="h-5 w-5 text-gray-400" /> Belum tersedia di
        sistem
      </h2>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Parameter ini butuh pencatatan baru; untuk sementara isi manual di
        dokumen Komdigi.
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {summary.unavailable.map((item) => (
          <li key={item.title} className="py-2 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">
              {item.title}
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              {item.standardLabel} — {item.reason}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodNotes({ notes }: { notes: string[] }) {
  return (
    <details className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <HiOutlineInformationCircle className="h-5 w-5 text-gray-400" /> Cara
        penghitungan
      </summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  );
}

/** Halaman Self-Assessment Komdigi: pilih tahun, lihat capaian, unduh Excel Lampiran I. */

interface SiteOption {
  id: string;
  name: string;
  kabupatenKota?: string | null;
}

export const TANPA_WILAYAH = "Belum ada kabupaten/kota";

/** Site dikelompokkan per kabupaten/kota, dimensi yang sama dengan Lampiran. */
export function kelompokkanPerWilayah(
  sites: SiteOption[],
): [string, SiteOption[]][] {
  const kelompok = new Map<string, SiteOption[]>();
  for (const site of sites) {
    const wilayah = site.kabupatenKota?.trim() || TANPA_WILAYAH;
    kelompok.set(wilayah, [...(kelompok.get(wilayah) ?? []), site]);
  }

  // Site tanpa wilayah ditaruh terakhir: ia perlu dibereskan, bukan dipilih.
  return [...kelompok.entries()].sort(([a], [b]) =>
    a === TANPA_WILAYAH
      ? 1
      : b === TANPA_WILAYAH
        ? -1
        : a.localeCompare(b, "id"),
  );
}

/**
 * Pemilih site yang dilaporkan.
 *
 * Izin penyelenggaraan bisa mencakup sebagian wilayah saja, jadi melaporkan
 * seluruh site akan menyalahi angka yang semestinya disampaikan. Tanpa pilihan
 * apa pun berarti seluruh site — bukan nol site.
 */
function SitePicker({
  sites,
  dipilih,
  onUbah,
}: {
  sites: SiteOption[];
  dipilih: string[];
  onUbah: (ids: string[]) => void;
}) {
  if (sites.length === 0) return null;

  const semua = dipilih.length === 0;
  const kelompok = kelompokkanPerWilayah(sites);

  const toggle = (id: string) =>
    onUbah(
      dipilih.includes(id) ? dipilih.filter((x) => x !== id) : [...dipilih, id],
    );

  const toggleWilayah = (anggota: SiteOption[]) => {
    const ids = anggota.map((site) => site.id);
    const semuaTerpilih = ids.every((id) => dipilih.includes(id));
    onUbah(
      semuaTerpilih
        ? dipilih.filter((id) => !ids.includes(id))
        : [...new Set([...dipilih, ...ids])],
    );
  };

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow dark:bg-gray-800">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Site yang dilaporkan
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {semua
              ? `Semua ${sites.length} site ikut dilaporkan.`
              : `${dipilih.length} dari ${sites.length} site dilaporkan.`}
          </p>
        </div>
        {!semua && (
          <button
            type="button"
            onClick={() => onUbah([])}
            className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 sm:self-auto"
          >
            Laporkan semua site
          </button>
        )}
      </div>

      <div className="space-y-3">
        {kelompok.map(([wilayah, anggota]) => {
          const tanpaWilayah = wilayah === TANPA_WILAYAH;
          const semuaTerpilih = anggota.every((site) =>
            dipilih.includes(site.id),
          );

          return (
            <div
              key={wilayah}
              className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`text-sm font-medium ${
                    tanpaWilayah
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {wilayah}
                </p>
                <button
                  type="button"
                  onClick={() => toggleWilayah(anggota)}
                  className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {semuaTerpilih ? "Lepas semua" : "Pilih semua"}
                </button>
              </div>

              {tanpaWilayah && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Komdigi meminta rincian per kabupaten/kota. Lengkapi di
                  pengaturan site agar site ini masuk agregasi wilayah.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {anggota.map((site) => {
                  const aktif = dipilih.includes(site.id);
                  return (
                    <button
                      key={site.id}
                      type="button"
                      aria-pressed={aktif}
                      onClick={() => toggle(site.id)}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        aktif
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
                      }`}
                    >
                      {site.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SelfAssessmentClient({
  skema,
  judul,
}: {
  skema: LicenseScheme;
  judul: string;
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const { data: sites } = useApi<SiteOption[]>(SITES_URL);
  const filterSite = siteIds.length > 0 ? `&siteIds=${siteIds.join(",")}` : "";
  const {
    data: summary,
    isLoading,
    error,
  } = useApi<SelfAssessmentSummary>(
    `${REPORT_URL}?skema=${skema}&year=${year}${filterSite}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {judul}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Capaian standar mutu layanan untuk laporan mandiri. Lampiran I
            dikirim ke Komdigi; ringkasan internal untuk ditelaah sendiri.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Tahun laporan"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {selectableYears(currentYear, SELECTABLE_YEAR_COUNT).map(
              (option) => (
                <option key={option} value={option}>
                  Tahun {option}
                </option>
              ),
            )}
          </select>
          <a
            href={`${REPORT_URL}/export?skema=${skema}&year=${year}${filterSite}`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" /> Lampiran I
          </a>
          {/* Berkas kerja sendiri, bukan yang dikirim ke Komdigi — labelnya
              dibedakan agar tidak tertukar saat pelaporan. */}
          <a
            href={`${REPORT_URL}/ringkasan?skema=${skema}&year=${year}${filterSite}`}
            download
            title="Agregasi bulanan, kuartalan, dan per kabupaten/kota untuk ditelaah sendiri"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" /> Ringkasan internal
          </a>
          <button
            type="button"
            onClick={() => setIsDocumentFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <HiOutlineDocumentText className="h-4 w-4" /> Dokumen Word
          </button>
        </div>
      </div>

      <SitePicker sites={sites ?? []} dipilih={siteIds} onUbah={setSiteIds} />

      {isLoading && <PageLoader />}
      {error && !isLoading && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          Gagal memuat laporan. Coba muat ulang halaman.
        </div>
      )}

      {summary && !isLoading && (
        <>
          <DataWarnings summary={summary} />
          {summary.parameters.map((parameter) => (
            <ParameterCard key={parameter.key} parameter={parameter} />
          ))}
          <UpcomingParameters summary={summary} />
          <MethodNotes notes={summary.notes} />
        </>
      )}

      {isDocumentFormOpen && (
        <DocumentFormModal
          skema={skema}
          year={year}
          onClose={() => setIsDocumentFormOpen(false)}
        />
      )}
    </div>
  );
}
