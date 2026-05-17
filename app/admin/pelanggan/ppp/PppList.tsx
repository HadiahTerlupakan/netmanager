"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useCallback } from "react";
import {
  HiOutlinePlus,
  HiArrowPath,
  HiMagnifyingGlass,
  HiXMark,
} from "react-icons/hi2";
import Link from "next/link";
import PageLoader from "@/components/ui/PageLoader";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { SiteFilter } from "@/components/common/SiteFilter";
import {
  createPppListColumns,
  renderPppListActions,
  type PelangganPPP,
} from "./pppListColumns";
import { deletePppCustomer, updatePppCustomerStatus } from "./pppListActions";

export default function PelangganPPPPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pelanggans, setPelanggans] = useState<PelangganPPP[]>([]);
  const [disableDuration, setDisableDuration] = useState<number>(5);

  // Filters
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when other filters change
  const [prevFilterKey, setPrevFilterKey] = useState<string>(
    `${siteId ?? ""}|${statusFilter}`,
  );
  const filterKey = `${siteId ?? ""}|${statusFilter}`;
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (siteId) params.append("siteId", siteId);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter) params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const [resPelanggan, resSettings] = await Promise.all([
        fetch(`/api/pelanggan-ppp?${params.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        }),
        fetch("/api/settings/general"),
      ]);

      if (!resPelanggan.ok) throw new Error("Gagal memuat data pelanggan PPP");

      if (resSettings.ok) {
        try {
          const settingsJson = await resSettings.json();
          const settingsData = settingsJson.data || settingsJson;
          if (settingsData.disablePerpanjanganPaket) {
            setDisableDuration(
              parseInt(settingsData.disablePerpanjanganPaket) || 5,
            );
          }
        } catch (_e) {
          clientLogger.error("Error parsing settings:", _e);
        }
      }

      let data: PelangganPPP[] = [];
      try {
        const text = await resPelanggan.text();
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            data = parsed;
            setTotalPages(1);
          } else if (parsed && parsed.data && Array.isArray(parsed.data)) {
            data = parsed.data;
            if (parsed.meta) {
              setTotalPages(Math.ceil((parsed.meta.total || 0) / limit));
            }
          } else if (parsed.error) {
            throw new Error(parsed.error);
          } else {
            data = [];
          }
        }
      } catch (_e) {
        throw new Error("Gagal memproses data pelanggan");
      }

      setPelanggans(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data",
      );
    } finally {
      setLoading(false);
    }
  }, [siteId, debouncedSearch, statusFilter, page, limit]);

  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
  const loadKey = `${siteId ?? ""}|${debouncedSearch}|${statusFilter}|${page}|${limit}`;
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    void loadData();
  }

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus pelanggan ini? Tindakan ini tidak dapat dibatalkan.",
      )
    )
      return;

    try {
      await deletePppCustomer(id);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghapus data",
      );
    }
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: string,
    actionName: string,
  ) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin mengubah status pelanggan ini menjadi ${actionName}? Akses internet akan ${newStatus === "AKTIF" ? "diaktifkan" : "dimatikan"}.`,
      )
    )
      return;

    try {
      setLoading(true);
      await updatePppCustomerStatus(id, newStatus);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setLoading(false);
    }
  };

  const columns = createPppListColumns(disableDuration);

  if (loading && pelanggans.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pelanggan PPP
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola data dan status akses internet pelanggan PPPoE
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <HiArrowPath className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
            Refresh
          </button>
          <Link
            href="/admin/pelanggan/ppp/create"
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all"
          >
            <HiOutlinePlus className="-ml-1 mr-2 h-5 w-5 text-white" />
            <span className="text-white">Tambah Pelanggan</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-4 border border-rose-200 dark:border-rose-800">
          <div className="flex">
            <HiXMark className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-rose-800 dark:text-rose-200">
                Terjadi kesalahan
              </h3>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FILTER SECTION */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Pencarian
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                className="block w-full rounded-lg border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 transition-all"
                placeholder="Cari nama, ID, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Site Area
            </label>
            <SiteFilter
              value={siteId || ""}
              onSiteChange={(id) => setSiteId(id || "")}
              resource="pelanggan"
            />
          </div>
          <div className="w-full md:w-48">
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Status
            </label>
            <select
              id="status"
              className="block w-full rounded-lg border-0 py-2.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="ISOLIR">Isolir</option>
              <option value="DISMANTLE">Dismantle</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={pelanggans}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={
            searchQuery
              ? "Pelanggan tidak ditemukan berdasarkan pencarian Anda."
              : "Belum ada data pelanggan PPP"
          }
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          renderActions={(item: PelangganPPP) => {
            const allowed = (() => {
              const today = new Date();
              today.setTime(new Date(today.toDateString()).getTime());
              const jatuhTempoDate = new Date(item.jatuhTempo);
              jatuhTempoDate.setTime(
                new Date(jatuhTempoDate.toDateString()).getTime(),
              );
              const allowedDate = new Date(jatuhTempoDate);
              allowedDate.setDate(allowedDate.getDate() - disableDuration);
              return today >= allowedDate;
            })();

            return renderPppListActions(
              item,
              allowed,
              disableDuration,
              handleDelete,
              handleStatusUpdate,
            );
          }}
        />
      </div>
    </div>
  );
}
