"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MdCheckCircle,
  MdCancel,
  MdPending,
  MdDoneAll,
  MdPlayArrow,
  MdLocationOn,
  MdDelete,
  MdEdit,
} from "react-icons/md";
import { FaBuilding } from "react-icons/fa";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import {
  fetchWithHandling,
  isFetchError,
  formatErrorMessage,
} from "@/lib/utils/fetch-wrapper";
import {
  formatForDateTimeInput,
  toISOString,
  formatDateDisplay,
  formatTimeDisplay,
  getDayName,
} from "@/lib/utils/datetime";
import {
  validateReason,
  validateRejectionReason,
  validateTimeRange,
} from "@/lib/utils/validation";
import type { Overtime } from "./types";
import { RateLimitWarning } from "./components/RateLimitWarning";
import { OvertimeSummaryCards } from "./components/OvertimeSummaryCards";
import { OvertimeFilters } from "./components/OvertimeFilters";
import { RejectModal } from "./components/RejectModal";
import { EditModal } from "./components/EditModal";
import { PhotoModal } from "./components/PhotoModal";

export function ClientComponent() {
  const { hasPermission } = usePermission();
  const { showToast } = useToast();
  const canVerify = hasPermission("lembur:verify");
  const canUpdate = hasPermission("lembur:update");
  const canDelete = hasPermission("lembur:delete");

  const [requests, setRequests] = useState<Overtime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Edit State
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    reason: "",
    startTime: "",
    endTime: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Pagination & Stats
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [siteId, setSiteId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [holidayFilter, setHolidayFilter] = useState("");

  // Debounced filters to prevent race conditions
  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);
  const debouncedStatusFilter = useDebounce(statusFilter, 300);
  const debouncedSiteId = useDebounce(siteId, 300);
  const debouncedDepartmentId = useDebounce(departmentId, 300);
  const debouncedHolidayFilter = useDebounce(holidayFilter, 300);

  // Options
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  // Handle rate limit countdown
  const fetchOptions = useCallback(async () => {
    try {
      const response = await fetchWithHandling<{
        sites: { id: string; name: string }[];
        departments: { id: string; name: string }[];
      }>("/api/admin/options?resource=lembur");
      if (response.data) {
        setSites(response.data.sites || []);
        setDepartments(response.data.departments || []);
      }
    } catch (error) {
      if (isFetchError(error)) {
        showToast("error", formatErrorMessage(error));
      }
    }
  }, [showToast]);

  const fetchRequests = useCallback(
    async (signal?: AbortSignal) => {
      if (retryCountdown !== null) return; // Don't fetch during rate limit

      setIsLoading(true);
      try {
        const query = new URLSearchParams({
          page: page.toString(),
          limit: "10",
          ...(debouncedStartDate && { startDate: debouncedStartDate }),
          ...(debouncedEndDate && { endDate: debouncedEndDate }),
          ...(debouncedStatusFilter && { status: debouncedStatusFilter }),
          ...(debouncedSiteId && { siteId: debouncedSiteId }),
          ...(debouncedDepartmentId && { departmentId: debouncedDepartmentId }),
          ...(debouncedHolidayFilter && {
            holidayType: debouncedHolidayFilter,
          }), // Server-side filter
        });

        const response = await fetchWithHandling<Overtime[]>(
          `/api/admin/lembur?${query.toString()}`,
          { signal },
        );

        setRequests(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalItems(response.pagination?.total || 0);
        if (response.summary) setSummary(response.summary);
      } catch (error) {
        if (isFetchError(error)) {
          if (error.retryAfter) {
            setRetryCountdown(error.retryAfter);
          }
          showToast("error", formatErrorMessage(error));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      page,
      debouncedStartDate,
      debouncedEndDate,
      debouncedStatusFilter,
      debouncedSiteId,
      debouncedDepartmentId,
      debouncedHolidayFilter,
      retryCountdown,
      showToast,
    ],
  );

  useEffect(() => {
    if (retryCountdown !== null && retryCountdown > 0) {
      const timer = setTimeout(
        () => setRetryCountdown(retryCountdown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  if (retryCountdown === 0) {
    setRetryCountdown(null);
  }

  const [hasFetchedOptions, setHasFetchedOptions] = useState(false);
  if (!hasFetchedOptions) {
    setHasFetchedOptions(true);
    void fetchOptions();
  }

  const [prevFetchKey, setPrevFetchKey] = useState<string | null>(null);
  const fetchKey = `${page}|${debouncedStartDate}|${debouncedEndDate}|${debouncedStatusFilter}|${debouncedSiteId}|${debouncedDepartmentId}|${debouncedHolidayFilter}|${retryCountdown}`;
  if (prevFetchKey !== fetchKey) {
    setPrevFetchKey(fetchKey);
    void fetchRequests();
  }

  const handleAction = async (
    id: string,
    action: "approve" | "reject",
    reason?: string,
  ) => {
    // Validate rejection reason
    if (action === "reject") {
      const validation = validateRejectionReason(reason || "");
      if (!validation.valid) {
        setRejectError(validation.error || "Alasan tidak valid");
        return;
      }
    }

    setProcessingId(id);
    try {
      await fetchWithHandling(`/api/admin/lembur/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason }),
      });

      showToast(
        "success",
        action === "approve" ? "Lembur Disetujui" : "Lembur Ditolak",
      );

      await fetchRequests();
      if (action === "reject") {
        setRejectId(null);
        setRejectReason("");
        setRejectError(null);
      }
    } catch (error) {
      if (isFetchError(error)) {
        if (error.retryAfter) {
          setRetryCountdown(error.retryAfter);
        }
        showToast("error", formatErrorMessage(error));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const openEditModal = (item: Overtime) => {
    setEditId(item.id);
    setEditErrors({});
    setEditForm({
      reason: item.reason,
      startTime: formatForDateTimeInput(item.startTime),
      endTime: formatForDateTimeInput(item.endTime),
    });
  };

  const handleEditSubmit = async () => {
    if (!editId) return;

    // Validate before submit
    const errors: Record<string, string> = {};

    const reasonValidation = validateReason(editForm.reason);
    if (!reasonValidation.valid) {
      errors.reason = reasonValidation.error || "Alasan tidak valid";
    }

    const timeValidation = validateTimeRange(
      editForm.startTime,
      editForm.endTime,
    );
    if (!timeValidation.valid) {
      errors.time = timeValidation.error || "Waktu tidak valid";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setProcessingId(editId);
    try {
      const payload: Record<string, string | null> = {
        reason: editForm.reason,
      };
      if (editForm.startTime)
        payload.startTime = toISOString(editForm.startTime);
      if (editForm.endTime) payload.endTime = toISOString(editForm.endTime);

      await fetchWithHandling(`/api/admin/lembur/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      showToast("success", "Data lembur berhasil diperbarui");

      await fetchRequests();
      setEditId(null);
      setEditErrors({});
    } catch (error) {
      if (isFetchError(error)) {
        if (error.retryAfter) {
          setRetryCountdown(error.retryAfter);
        }
        showToast("error", formatErrorMessage(error));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data lembur ini?")) return;

    setProcessingId(id);
    try {
      await fetchWithHandling(`/api/admin/lembur/${id}`, {
        method: "DELETE",
      });

      showToast("success", "Data lembur berhasil dihapus");

      await fetchRequests();
    } catch (error) {
      if (isFetchError(error)) {
        if (error.retryAfter) {
          setRetryCountdown(error.retryAfter);
        }
        showToast("error", formatErrorMessage(error));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <MdCheckCircle /> Disetujui
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse">
            <MdPlayArrow /> Sedang Berjalan
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <MdDoneAll /> Selesai
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <MdCancel /> Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <MdPending /> Menunggu
          </span>
        );
    }
  };

  // Define columns for ResponsiveTable
  const columns: Column<Overtime>[] = [
    {
      key: "user",
      header: "Karyawan",
      priority: "primary",
      render: (item) => {
        if (!item.user) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 shrink-0">
                <span className="font-bold text-xs">?</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-400 dark:text-gray-500 text-sm italic">
                  Data user tidak tersedia
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 relative overflow-hidden">
              {item.user.image ? (
                <Image
                  src={item.user.image}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover rounded-full"
                />
              ) : (
                <span className="font-bold text-xs">
                  {item.user.name?.charAt(0) || "U"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {item.user.name || "Tidak diketahui"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {item.user.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "siteDept",
      header: "Site/Dept",
      priority: "secondary",
      render: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {item.user?.sites?.name || "-"}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <FaBuilding className="text-[10px]" />{" "}
            {item.user?.departments?.name || "-"}
          </div>
        </div>
      ),
    },

    {
      key: "tanggalAlasan",
      header: "Tanggal & Alasan",
      priority: "primary",
      render: (item) => {
        const dayName = getDayName(item.createdAt);
        const dateStr = formatDateDisplay(item.createdAt);

        return (
          <div className="text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <span className="text-sm font-medium">{dateStr}</span>
                <span className="text-xs text-gray-500 ml-1">({dayName})</span>
              </div>
              {/* Holiday/Off-day Badge */}
              {item.isHolidayOvertime && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    item.isNationalHoliday
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : item.isOffDay
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  }`}
                  title={item.holidayDescription}
                >
                  {item.isNationalHoliday
                    ? "🎌 Libur Nasional"
                    : item.isOffDay
                      ? "📅 Hari Libur"
                      : "🏖️ Cuti Bersama"}
                </span>
              )}
            </div>
            <p
              className="text-xs mt-1 max-w-[150px] truncate"
              title={item.reason}
            >
              &quot;{item.reason}&quot;
            </p>
            {item.rejectionReason && (
              <p
                className="text-xs text-red-500 mt-1 italic truncate"
                title={item.rejectionReason}
              >
                Ket: {item.rejectionReason}
              </p>
            )}
          </div>
        );
      },
    },

    {
      key: "waktuLembur",
      header: "Waktu Lembur",
      priority: "secondary",
      render: (item) => (
        <div className="flex flex-col gap-1 text-xs">
          {item.startTime ? (
            <div className="flex items-center gap-1">
              <span className="font-bold text-green-600">Start:</span>
              {formatTimeDisplay(item.startTime)}
            </div>
          ) : (
            <span className="text-gray-400 italic">Belum mulai</span>
          )}
          {item.endTime && (
            <div className="flex items-center gap-1">
              <span className="font-bold text-red-600">End:</span>
              {formatTimeDisplay(item.endTime)}
            </div>
          )}
          {item.duration != null && (
            <span className="text-purple-600 font-bold mt-1 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded w-fit">
              {item.duration} Menit
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lokasi",
      header: "Lokasi",
      priority: "tertiary",
      render: (item) => (
        <div className="flex flex-col gap-2 max-w-[180px]">
          {item.startLocation ? (
            <a
              href={`https://www.google.com/maps?q=${item.startLocation}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
              title={`Lokasi Mulai: ${item.startLocation}`}
            >
              <MdLocationOn className="text-green-600 shrink-0" />
              <span className="text-xs group-hover:underline font-medium">
                Mulai
              </span>
            </a>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
          {item.endLocation && (
            <a
              href={`https://www.google.com/maps?q=${item.endLocation}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
              title={`Lokasi Selesai: ${item.endLocation}`}
            >
              <MdLocationOn className="text-red-600 shrink-0" />
              <span className="text-xs group-hover:underline font-medium">
                Selesai
              </span>
            </a>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: "foto",
      header: "Foto",
      priority: "tertiary",
      render: (item) => (
        <div className="flex gap-2">
          {item.startPhoto && (
            <Button
              variant="ghost"
              className="p-0 h-auto w-auto hover:bg-transparent"
              onClick={() => setSelectedPhoto(item.startPhoto!)}
              title="Foto Mulai"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-all ring-2 ring-transparent hover:ring-green-500 dark:hover:ring-green-400 relative">
                <Image
                  src={item.startPhoto}
                  alt="Start"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            </Button>
          )}
          {item.endPhoto && (
            <Button
              variant="ghost"
              className="p-0 h-auto w-auto hover:bg-transparent"
              onClick={() => setSelectedPhoto(item.endPhoto!)}
              title="Foto Selesai"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-all ring-2 ring-transparent hover:ring-red-500 dark:hover:ring-red-400 relative">
                <Image
                  src={item.endPhoto}
                  alt="End"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            </Button>
          )}
          {!item.startPhoto && !item.endPhoto && (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
  ];

  // Render actions for each row
  const renderActions = (item: Overtime) => (
    <div className="flex items-center gap-1">
      {item.status === "PENDING" && canVerify && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleAction(item.id, "approve")}
            disabled={processingId === item.id}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            title="Setujui (Verify)"
          >
            <MdCheckCircle className="text-lg" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setRejectId(item.id)}
            disabled={processingId === item.id}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Tolak (Verify)"
          >
            <MdCancel className="text-lg" />
          </Button>
        </>
      )}
      {canUpdate && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openEditModal(item)}
          disabled={processingId === item.id}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          title="Edit Data"
        >
          <MdEdit className="text-lg" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleDelete(item.id)}
          disabled={processingId === item.id}
          className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          title="Hapus"
        >
          <MdDelete className="text-lg" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        Manajemen Lembur
      </h1>

      <RateLimitWarning retryCountdown={retryCountdown} />

      <OvertimeSummaryCards summary={summary} totalItems={totalItems} />

      <OvertimeFilters
        startDate={startDate}
        endDate={endDate}
        siteId={siteId}
        departmentId={departmentId}
        statusFilter={statusFilter}
        holidayFilter={holidayFilter}
        sites={sites}
        departments={departments}
        retryCountdown={retryCountdown}
        onStartDateChange={(value) => {
          setStartDate(value);
          setPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setPage(1);
        }}
        onSiteIdChange={(value) => {
          setSiteId(value);
          setPage(1);
        }}
        onDepartmentIdChange={(value) => {
          setDepartmentId(value);
          setPage(1);
        }}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onHolidayFilterChange={(value) => {
          setHolidayFilter(value);
          setPage(1);
        }}
        onSearch={() => fetchRequests()}
      />

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={requests}
          columns={columns}
          keyField="id"
          loading={isLoading}
          emptyMessage="Tidak ada data pengajuan lembur yang sesuai filter."
          loadingMessage="Memuat data..."
          renderActions={renderActions}
        />

        {/* Pagination Controls */}
        <div className="px-6 py-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-3">
          <Button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Halaman {page} dari {totalPages} ({totalItems} Data)
          </span>
          <Button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Selanjutnya
          </Button>
        </div>
      </div>

      <RejectModal
        isOpen={!!rejectId}
        rejectReason={rejectReason}
        rejectError={rejectError}
        processingId={processingId}
        rejectId={rejectId}
        onReasonChange={(value) => {
          setRejectReason(value);
          setRejectError(null);
        }}
        onClose={() => {
          setRejectId(null);
          setRejectReason("");
          setRejectError(null);
        }}
        onSubmit={() => handleAction(rejectId!, "reject", rejectReason)}
      />

      <EditModal
        isOpen={!!editId}
        editForm={editForm}
        editErrors={editErrors}
        processingId={processingId}
        editId={editId}
        onFormChange={setEditForm}
        onErrorChange={setEditErrors}
        onClose={() => {
          setEditId(null);
          setEditErrors({});
        }}
        onSubmit={handleEditSubmit}
      />

      <PhotoModal
        photoUrl={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  );
}
