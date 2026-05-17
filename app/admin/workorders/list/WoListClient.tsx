"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/hooks/useApi";
import Link from "next/link";
import { intervalToDuration, formatDuration, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  HiPlus,
  HiMagnifyingGlass,
  HiAdjustmentsHorizontal,
  HiCheckCircle,
  HiXMark,
  HiTrash,
  HiXCircle,
  HiBellAlert,
  HiWrenchScrewdriver,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/use-permission";
import {
  buildTopCustomerSearchValue,
  buildVisibleTopCustomers,
  buildWorkOrderSummaryCardsFromCounts,
  type TopWorkOrderCustomer,
  type WorkOrderListSummary,
} from "./summary";
import {
  EMPTY_WORK_ORDER_SUMMARY,
  WORK_ORDER_PAGE_SIZE,
  WORK_ORDER_SEARCH_DEBOUNCE_MS,
} from "./constants";
import { WorkOrderSummarySection } from "./WorkOrderSummarySection";

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  isInternal: boolean;
  requestedById: string | null; // Added requestedById
  pelanggan?: {
    nama: string;
    idPelanggan: string;
    noTelp?: string | null;
  } | null;
  assignedTo?: {
    name: string;
    role?: {
      isTechnical: boolean;
    } | null;
  } | null;
  assignedMitra?: {
    name: string;
  } | null;
  department?: {
    name: string;
  } | null;
  site?: {
    name: string;
  } | null;
  createdBy?: {
    name: string | null;
    role?: {
      isTechnical: boolean;
    } | null;
  } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const statusColors: Record<string, string> = {
  REQUESTED:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  PENDING: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  ASSIGNED: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  IN_PROGRESS:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  ON_HOLD:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  COMPLETED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  VERIFIED:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  CLOSED: "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  REJECTED: "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200",
};

const statusLabels: Record<string, string> = {
  REQUESTED: "Request",
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  NORMAL: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  HIGH: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  URGENT: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  CRITICAL:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
};

export function ClientComponent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const { hasPermission } = usePermission();

  // CRUD permissions
  const canCreate = hasPermission("list:create");
  const canDelete = hasPermission("list:delete"); // Hapus permanen

  // Workflow action permissions (terpisah dari CRUD)
  const canCancel = hasPermission("list:cancel"); // Batalkan WO
  const canVerify = hasPermission("list:verify"); // Verifikasi & Tolak WO
  const canSendReminder = hasPermission("workorders:reminder"); // Kirim Reminder Manual
  const canApproveRequest =
    hasPermission("workorders:approve_request") ||
    hasPermission("list:approve_request"); // Approve/Reject WO Request

  const [initialLoading, setInitialLoading] = useState(true);
  const [pinnedTopCustomers, setPinnedTopCustomers] = useState<
    TopWorkOrderCustomer[]
  >([]);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // PHASE 5: Debounced search value
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterWoType, setFilterWoType] = useState(""); // 'customer' | 'internal' | ''
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Build URL untuk fetch work orders via TanStack Query
  const workOrdersUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: WORK_ORDER_PAGE_SIZE.toString(),
    });
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (filterStatus) params.append("status", filterStatus);
    if (filterPriority) params.append("priority", filterPriority);
    if (filterType) params.append("type", filterType);
    if (filterSite) params.append("siteId", filterSite);
    if (filterWoType) params.append("woType", filterWoType);
    if (unassignedOnly) params.append("unassignedOnly", "true");
    return `/api/admin/workorders?${params}`;
  }, [
    page,
    debouncedSearch,
    filterStatus,
    filterPriority,
    filterType,
    filterSite,
    filterWoType,
    unassignedOnly,
  ]);

  interface WorkOrderListData {
    workOrders?: WorkOrder[];
    summary?: WorkOrderListSummary;
    total?: number;
    totalPages?: number;
  }

  const {
    data: workOrdersResp,
    isLoading: loading,
    mutate: refetchWorkOrders,
  } = useApi<WorkOrderListData>(workOrdersUrl);

  const workOrders = workOrdersResp?.workOrders ?? [];
  const summary = workOrdersResp?.summary ?? EMPTY_WORK_ORDER_SUMMARY;
  const total = workOrdersResp?.total ?? 0;
  const totalPages = workOrdersResp?.totalPages ?? 1;

  // Set initialLoading to false setelah first response
  if (initialLoading && !loading && workOrdersResp !== undefined) {
    setInitialLoading(false);
  }
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // PHASE 5: Debounce search input (300ms delay)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, WORK_ORDER_SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Approval states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processingApproval, setProcessingApproval] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(
    null,
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(
    null,
  );

  // WO Request Approval states
  const [showApproveRequestModal, setShowApproveRequestModal] = useState(false);
  const [showRejectRequestModal, setShowRejectRequestModal] = useState(false);
  const [rejectRequestReason, setRejectRequestReason] = useState("");

  // Reminder Modal states
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const fetchSites = async () => {
    try {
      const response = await fetch("/api/admin/sites?activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setSites(data.data || []);
      }
    } catch (error: unknown) {
      console.error("Error fetching sites:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      // Fetch only departments marked as reminder target
      const response = await fetch("/api/admin/departments?reminderOnly=true");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || data || []);
      }
    } catch (error: unknown) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchWorkOrders = useCallback(() => {
    void refetchWorkOrders();
  }, [refetchWorkOrders]);

  useEffect(() => {
    if (!session?.user || status !== "authenticated") return undefined;
    const handle = setTimeout(() => {
      void fetchSites();
      void fetchDepartments();
    }, 0);
    return () => clearTimeout(handle);
  }, [session, status]);

  const queryClient = useQueryClient();

  /**
   * Verify work order dengan optimistic update.
   *
   * UX: row langsung berubah status VERIFIED sebelum server confirm.
   * Bila gagal, rollback ke state sebelumnya plus alert error.
   */
  const verifyWoMutation = useMutation<
    void,
    Error,
    string,
    { previous: WorkOrderListData | undefined }
  >({
    mutationFn: async (id) => {
      const response = await fetch(`/api/admin/workorders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      });
      if (!response.ok) {
        const errData = await response
          .json()
          .catch(() => ({}) as { error?: string });
        throw new Error(errData.error || "Gagal memverifikasi work order");
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [workOrdersUrl] });
      const previous = queryClient.getQueryData<WorkOrderListData>([
        workOrdersUrl,
      ]);
      queryClient.setQueryData<WorkOrderListData>([workOrdersUrl], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          workOrders: (prev.workOrders ?? []).map((wo) =>
            wo.id === id ? { ...wo, status: "VERIFIED" } : wo,
          ),
        };
      });
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData([workOrdersUrl], context.previous);
      }
      alert(error.message || "Terjadi kesalahan");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [workOrdersUrl] });
    },
  });

  const handleVerify = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Apakah Anda yakin ingin memverifikasi work order ini?"))
      return;
    verifyWoMutation.mutate(id);
  };

  const openRejectModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkOrderId(id);
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Silakan berikan alasan penolakan");
      return;
    }

    if (!selectedWorkOrderId) return;

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "IN_PROGRESS",
            rejectionReason: rejectReason,
          }),
        },
      );

      if (response.ok) {
        setShowRejectModal(false);
        setRejectReason("");
        setSelectedWorkOrderId(null);
        fetchWorkOrders();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal menolak work order");
      }
    } catch (error: unknown) {
      console.error("Error rejecting:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const openCancelModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkOrderId(id);
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert("Silakan berikan alasan pembatalan");
      return;
    }

    if (!selectedWorkOrderId) return;

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelReason }),
        },
      );

      if (response.ok) {
        setShowCancelModal(false);
        setCancelReason("");
        setSelectedWorkOrderId(null);
        fetchWorkOrders();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal membatalkan work order");
      }
    } catch (error: unknown) {
      console.error("Error cancelling:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const openDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkOrderId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedWorkOrderId) return;

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}?permanent=true`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedWorkOrderId(null);
        showToast("success", "Work Order berhasil dihapus permanen");
        fetchWorkOrders();
      } else {
        showToast("error", "Gagal menghapus work order");
      }
    } catch (error: unknown) {
      console.error("Error deleting:", error);
      showToast("error", "Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  // Open reminder modal instead of sending directly
  const handleOpenReminderModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkOrderId(id);
    setSelectedDepartmentId("");
    setShowReminderModal(true);
  };

  // Actually send reminder after department selection
  const handleSendReminder = async () => {
    if (!selectedWorkOrderId) return;

    setSendingReminderId(selectedWorkOrderId);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}/reminder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: selectedDepartmentId || undefined,
          }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        showToast("success", data.message || "Reminder terkirim");
        setShowReminderModal(false);
      } else {
        showToast("error", data.error || "Gagal mengirim reminder");
      }
    } catch (error: unknown) {
      console.error("Error sending reminder:", error);
      showToast("error", "Terjadi kesalahan");
    } finally {
      setSendingReminderId(null);
      setSelectedWorkOrderId(null);
    }
  };

  // Handler untuk Approve WO Request
  const handleApproveRequest = async () => {
    if (!selectedWorkOrderId) return;

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE" }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        showToast("success", "WO Request berhasil disetujui");
        setShowApproveRequestModal(false);
        setSelectedWorkOrderId(null);
        fetchWorkOrders();
      } else {
        showToast("error", data.error || "Gagal menyetujui request");
      }
    } catch (error: unknown) {
      console.error("Error approving request:", error);
      showToast("error", "Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  // Handler untuk Reject WO Request
  const handleRejectRequest = async () => {
    if (!selectedWorkOrderId || !rejectRequestReason.trim()) {
      showToast("error", "Alasan penolakan wajib diisi");
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${selectedWorkOrderId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REJECT",
            reason: rejectRequestReason.trim(),
          }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        showToast("success", "WO Request berhasil ditolak");
        setShowRejectRequestModal(false);
        setRejectRequestReason("");
        setSelectedWorkOrderId(null);
        fetchWorkOrders();
      } else {
        showToast("error", data.error || "Gagal menolak request");
      }
    } catch (error: unknown) {
      console.error("Error rejecting request:", error);
      showToast("error", "Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPriority("");
    setFilterType("");
    setFilterSite("");
    setFilterWoType("");
    setUnassignedOnly(false);
    setPinnedTopCustomers([]);
    setSearch("");
  };

  const filterByTopCustomer = (customerName: string) => {
    setPinnedTopCustomers(
      buildVisibleTopCustomers(summary.topCustomers, pinnedTopCustomers),
    );
    setSearch(buildTopCustomerSearchValue(customerName));
    setPage(1);
  };

  const hasActiveFilters =
    filterStatus ||
    filterPriority ||
    filterType ||
    filterWoType ||
    unassignedOnly ||
    search;
  const summaryCards = buildWorkOrderSummaryCardsFromCounts(summary);
  const visibleTopCustomers = buildVisibleTopCustomers(
    summary.topCustomers,
    pinnedTopCustomers,
  );

  // Define columns for ResponsiveTable
  const columns: Column<WorkOrder>[] = [
    {
      key: "workOrderNumber",
      header: "WO Number",
      priority: "primary",
      render: (wo) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {wo.workOrderNumber}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      priority: "primary",
      render: (wo) => (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {wo.title}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {wo.type}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer / Dept",
      priority: "secondary",
      render: (wo) => {
        const isMobile = !!wo.requestedById;
        const sourceBadge = isMobile ? (
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] h-4 font-medium">
            Mobile App
          </Badge>
        ) : (
          <Badge className="bg-slate-50 text-slate-700 border-slate-100 text-[10px] h-4 font-medium">
            Portal Admin
          </Badge>
        );

        const employeeBadge = (wo.isInternal || wo.requestedById) && (
          <Badge className="bg-orange-50 text-orange-700 border-orange-100 text-[10px] h-4 font-medium">
            Karyawan
          </Badge>
        );

        // If pelanggan exists, show customer info
        if (wo.pelanggan) {
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-gray-900 dark:text-white font-semibold leading-none">
                  {wo.pelanggan.nama}
                </span>
                {sourceBadge}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {wo.pelanggan.idPelanggan}
                </span>
              </div>
            </div>
          );
        }

        // If no pelanggan but has contactName/department, show as Internal/Employee
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm text-gray-900 dark:text-white font-semibold leading-none">
                {wo.contactName || "Internal Request"}
              </span>
              {employeeBadge}
              {sourceBadge}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {wo.department?.name || (wo.isInternal ? "Internal / FOC" : "-")}
            </div>
          </div>
        );
      },
    },
    {
      key: "site",
      header: "Site",
      priority: "secondary",
      render: (wo) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {wo.site ? wo.site.name : "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (wo) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[wo.status]}`}
        >
          {statusLabels[wo.status]}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      priority: "secondary",
      render: (wo) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${priorityColors[wo.priority]}`}
        >
          {wo.priority}
        </span>
      ),
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      priority: "tertiary",
      render: (wo) => {
        if (wo.assignedMitra) {
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {wo.assignedMitra.name}
              </span>
              <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                Mitra
              </span>
            </div>
          );
        }
        if (wo.assignedTo) {
          const isTechnical = wo.assignedTo.role?.isTechnical;
          return (
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {wo.assignedTo.name}
                </span>
                {isTechnical && (
                  <HiWrenchScrewdriver
                    className="w-3.5 h-3.5 text-sky-500"
                    title="Tim Teknis"
                  />
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isTechnical ? "Teknis" : "Internal"}
              </span>
            </div>
          );
        }

        return <span className="text-gray-400 text-sm">Unassigned</span>;
      },
    },
    {
      key: "createdAtDate",
      header: "Tanggal Dibuat",
      priority: "tertiary",
      render: (wo) => (
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {format(new Date(wo.createdAt), "dd MMM yyyy HH:mm", {
            locale: localeId,
          })}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Durasi",
      priority: "tertiary",
      render: (wo) => {
        if (!wo.completedAt || !wo.startedAt)
          return <span className="text-gray-400">-</span>;

        const duration = intervalToDuration({
          start: new Date(wo.startedAt),
          end: new Date(wo.completedAt),
        });

        return (
          <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {formatDuration(duration, {
              format: ["days", "hours", "minutes"],
              locale: localeId,
            }) || "< 1 mnt"}
          </span>
        );
      },
    },
    {
      key: "createdBy",
      header: "Dibuat Oleh",
      priority: "tertiary",
      render: (wo) => {
        const isTechnical = wo.createdBy?.role?.isTechnical;
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {wo.createdBy?.name || "-"}
            </span>
            {isTechnical && (
              <HiWrenchScrewdriver
                className="w-3 h-3 text-gray-400"
                title="Tim Teknis"
              />
            )}
          </div>
        );
      },
    },
  ];

  // Render actions for each row
  const renderActions = (wo: WorkOrder) => (
    <>
      {wo.status !== "CANCELLED" &&
        wo.status !== "CLOSED" &&
        wo.status !== "COMPLETED" && (
          <>
            {canCancel && (
              <button
                onClick={(e) => openCancelModal(wo.id, e)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                title="Batalkan"
              >
                <HiXCircle className="w-5 h-5" />
              </button>
            )}
            {(wo.status === "PENDING" ||
              wo.status === "ASSIGNED" ||
              wo.status === "IN_PROGRESS") &&
              canSendReminder && (
                <button
                  onClick={(e) => handleOpenReminderModal(wo.id, e)}
                  disabled={sendingReminderId === wo.id}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded disabled:opacity-50"
                  title="Kirim Reminder"
                >
                  <HiBellAlert
                    className={`w-5 h-5 ${sendingReminderId === wo.id ? "animate-pulse text-sky-600" : ""}`}
                  />
                </button>
              )}
            {canDelete && (
              <button
                onClick={(e) => openDeleteModal(wo.id, e)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Hapus Permanen"
              >
                <HiTrash className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      {wo.status === "COMPLETED" && (
        <>
          {canVerify && (
            <>
              <button
                onClick={(e) => openRejectModal(wo.id, e)}
                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 rounded"
                title="Tolak"
              >
                <HiXMark className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => handleVerify(wo.id, e)}
                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 rounded"
                title="Verifikasi"
              >
                <HiCheckCircle className="w-5 h-5" />
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={(e) => openDeleteModal(wo.id, e)}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Hapus Permanen"
            >
              <HiTrash className="w-5 h-5" />
            </button>
          )}
        </>
      )}
      {wo.status === "CANCELLED" && canDelete && (
        <button
          onClick={(e) => openDeleteModal(wo.id, e)}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Hapus Permanen"
        >
          <HiTrash className="w-5 h-5" />
        </button>
      )}
      {wo.status === "REQUESTED" && canApproveRequest && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedWorkOrderId(wo.id);
              setShowRejectRequestModal(true);
            }}
            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 rounded"
            title="Tolak Request"
          >
            <HiXCircle className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedWorkOrderId(wo.id);
              setShowApproveRequestModal(true);
            }}
            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 rounded"
            title="Setujui Request"
          >
            <HiCheckCircle className="w-5 h-5" />
          </button>
        </>
      )}
    </>
  );

  if (status === "loading" || initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Work Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Total {total} work orders
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <HiAdjustmentsHorizontal className="w-5 h-5" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
            )}
          </button>
          {canCreate && (
            <Link
              href="/admin/workorders/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 font-semibold"
            >
              <HiPlus className="w-5 h-5 text-white" />
              <span className="text-white">New Work Order</span>
            </Link>
          )}
        </div>
      </div>

      <WorkOrderSummarySection
        summaryCards={summaryCards}
        visibleTopCustomers={visibleTopCustomers}
        onSelectTopCustomer={filterByTopCustomer}
      />

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters}>
                Reset
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="REQUESTED">Request (Menunggu)</option>
                <option value="PENDING">Pending</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="VERIFIED">Verified</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Priority</option>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="INSTALLATION">Installation</option>
                <option value="TROUBLESHOOT">Troubleshoot</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="UPGRADE">Upgrade</option>
                <option value="RELOCATION">Relocation</option>
                <option value="DISCONNECTION">Disconnection</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assignment
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Unassigned Only
                </span>
              </label>
            </div>

            <div className="md:col-span-4 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Site / Area
              </label>
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Semua Site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Jenis WO Filter: Customer vs Internal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Jenis WO
              </label>
              <select
                value={filterWoType}
                onChange={(e) => setFilterWoType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Semua</option>
                <option value="customer">Customer</option>
                <option value="internal">Internal (FOC)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by work order number, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <ResponsiveTable
          data={workOrders}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={
            hasActiveFilters
              ? "No work orders found with current filters"
              : "No work orders yet"
          }
          loadingMessage="Memuat data..."
          renderActions={renderActions}
          onRowClick={(wo) => router.push(`/admin/workorders/${wo.id}`)}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Menampilkan {(page - 1) * WORK_ORDER_PAGE_SIZE + 1} -{" "}
            {Math.min(page * WORK_ORDER_PAGE_SIZE, total)} dari {total} work
            orders
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Hal {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason("");
          setSelectedWorkOrderId(null);
        }}
        title="Tolak Hasil Pekerjaan"
        description="Work order akan dikembalikan ke status In Progress. Silakan berikan alasan penolakan."
        size="md"
      >
        <div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Alasan penolakan (wajib diisi)..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
          />
        </div>
        <ModalFooter>
          <button
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason("");
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <Button
            onClick={handleReject}
            disabled={processingApproval || !rejectReason.trim()}
            variant="destructive"
          >
            {processingApproval ? "Memproses..." : "Tolak & Kembalikan"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason("");
          setSelectedWorkOrderId(null);
        }}
        title="Batalkan Work Order"
        description="Tindakan ini tidak dapat dibatalkan. Work order akan ditandai sebagai Cancelled."
        size="md"
      >
        <div>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Alasan pembatalan (wajib diisi)..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
          />
        </div>
        <ModalFooter>
          <button
            onClick={() => {
              setShowCancelModal(false);
              setCancelReason("");
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Kembali
          </button>
          <Button
            onClick={handleCancel}
            disabled={processingApproval || !cancelReason.trim()}
            variant="destructive"
          >
            {processingApproval ? "Memproses..." : "Batalkan WO"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedWorkOrderId(null);
        }}
        title="Hapus Permanen Work Order?"
        description="Tindakan ini tidak dapat dibatalkan. Work Order beserta seluruh data terkait (tasks, history, lampiran) akan dihapus permanen dari database."
        size="md"
      >
        <ModalFooter>
          <button
            onClick={() => {
              setShowDeleteModal(false);
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <Button
            onClick={handleDelete}
            disabled={processingApproval}
            variant="destructive"
          >
            {processingApproval ? "Menghapus..." : "Ya, Hapus Permanen"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Approve WO Request Modal */}
      <Modal
        isOpen={showApproveRequestModal}
        onClose={() => {
          setShowApproveRequestModal(false);
          setSelectedWorkOrderId(null);
        }}
        title="Setujui WO Request"
        description="Apakah Anda yakin ingin menyetujui request ini? Work Order akan berubah status menjadi PENDING dan siap untuk di-assign ke teknisi."
        size="md"
      >
        <ModalFooter>
          <button
            onClick={() => {
              setShowApproveRequestModal(false);
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <Button
            onClick={handleApproveRequest}
            disabled={processingApproval}
            variant="success"
          >
            {processingApproval ? "Memproses..." : "Ya, Setujui"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reject WO Request Modal */}
      <Modal
        isOpen={showRejectRequestModal}
        onClose={() => {
          setShowRejectRequestModal(false);
          setRejectRequestReason("");
          setSelectedWorkOrderId(null);
        }}
        title="Tolak WO Request"
        description="Request akan ditolak dan pembuat request akan menerima notifikasi. Work Order akan berubah status menjadi REJECTED."
        size="md"
      >
        <div>
          <textarea
            value={rejectRequestReason}
            onChange={(e) => setRejectRequestReason(e.target.value)}
            placeholder="Alasan penolakan (wajib diisi)..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
          />
        </div>
        <ModalFooter>
          <button
            onClick={() => {
              setShowRejectRequestModal(false);
              setRejectRequestReason("");
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <Button
            onClick={handleRejectRequest}
            disabled={processingApproval || !rejectRequestReason.trim()}
            variant="destructive"
          >
            {processingApproval ? "Memproses..." : "Tolak Request"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reminder Modal with Department Selection */}
      <Modal
        isOpen={showReminderModal}
        onClose={() => {
          setShowReminderModal(false);
          setSelectedDepartmentId("");
          setSelectedWorkOrderId(null);
        }}
        title="Kirim Reminder"
        description="Pilih department target untuk mengirim reminder push notification ke teknisi."
        size="md"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Department
          </label>
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">-- Semua Teknisi di Site --</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Kosongkan untuk kirim ke semua teknisi di site WO ini
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => {
              setShowReminderModal(false);
              setSelectedDepartmentId("");
              setSelectedWorkOrderId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSendReminder}
            disabled={sendingReminderId !== null}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {sendingReminderId ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Mengirim...
              </>
            ) : (
              <>
                <HiBellAlert className="w-4 h-4" />
                Kirim Reminder
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
