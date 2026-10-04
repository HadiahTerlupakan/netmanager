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
import { DocumentFormModal } from "./DocumentFormModal";
import { ParameterCard } from "./ParameterCard";
import {
  formatDate,
  isHolidayCalendarIncomplete,
  selectableYears,
} from "./self-assessment-format";
import type { SelfAssessmentSummary } from "./self-assessment-types";

const REPORT_URL = "/api/admin/regulatory/self-assessment";
const SELECTABLE_YEAR_COUNT = 4;

function DataWarnings({ summary }: { summary: SelfAssessmentSummary }) {
  const { sitesWithoutRegion, lastHolidayDate } = summary.warnings;
  const isHolidayIncomplete = isHolidayCalendarIncomplete(lastHolidayDate);
  if (!sitesWithoutRegion.length && !isHolidayIncomplete) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <p className="flex items-center gap-2 font-medium">
        <HiOutlineExclamationTriangle className="h-5 w-5" /> Lengkapi data agar laporan akurat
      </p>
      {sitesWithoutRegion.length > 0 && (
        <p>
          Kabupaten/kota belum diisi untuk site: <strong>{sitesWithoutRegion.join(", ")}</strong>.{" "}
          <Link href="/admin/workorders/sites" className="underline">
            Isi di halaman Site
          </Link>
          .
        </p>
      )}
      {isHolidayIncomplete && (
        <p>
          Hari libur {summary.year}{" "}
          {lastHolidayDate ? `baru tercatat sampai ${formatDate(lastHolidayDate)}` : "belum dicatat"} — hari kerja
          pemulihan layanan bisa terhitung lebih banyak.{" "}
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
        <HiOutlineClock className="h-5 w-5 text-gray-400" /> Belum tersedia di sistem
      </h2>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Parameter ini butuh pencatatan baru; untuk sementara isi manual di dokumen Komdigi.
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {summary.unavailable.map((item) => (
          <li key={item.title} className="py-2 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
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
        <HiOutlineInformationCircle className="h-5 w-5 text-gray-400" /> Cara penghitungan
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
export function SelfAssessmentClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const { data: summary, isLoading, error } = useApi<SelfAssessmentSummary>(`${REPORT_URL}?year=${year}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Self-Assessment Komdigi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Capaian standar mutu layanan untuk laporan mandiri; unduh Excel untuk Lampiran I.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Tahun laporan"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {selectableYears(currentYear, SELECTABLE_YEAR_COUNT).map((option) => (
              <option key={option} value={option}>
                Tahun {option}
              </option>
            ))}
          </select>
          <a
            href={`${REPORT_URL}/export?year=${year}`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" /> Unduh Excel
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
        <DocumentFormModal year={year} onClose={() => setIsDocumentFormOpen(false)} />
      )}
    </div>
  );
}
