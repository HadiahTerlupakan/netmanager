"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  HiArrowLeft,
  HiPencil,
  HiCheck,
  HiClock,
  HiXMark,
  HiCheckCircle,
  HiChatBubbleLeftRight,
  HiCube,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import AddMaterialModal from "@/components/workorder/AddMaterialModal";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { useApi } from "@/lib/hooks/useApi";
import type { WorkOrderActivityPayload } from "@/lib/websocket/types";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/Button";

import type {
  WorkOrderDetail,
  MaterialDetailData,
  TimelineItem,
} from "./types";
import { statusColors } from "./types";
import { WoActionModals } from "./components/WoActionModals";
import { WoSidebar } from "./components/WoSidebar";
import { WoActivityTimeline } from "./components/WoActivityTimeline";
import { WoDiscussionTab } from "./components/WoDiscussionTab";
import { WoMaterialsTab } from "./components/WoMaterialsTab";
import { WoMaterialDetailModal } from "./components/WoMaterialDetailModal";

export function ClientComponent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const workOrderId = params?.id as string;
  const { hasPermission } = usePermission();

  // CRUD permissions
  const canUpdate = hasPermission("workorders:update");
  const canDelete = hasPermission("workorders:delete");

  // Workflow action permissions (terpisah dari CRUD)
  const canCancel = hasPermission("workorders:cancel");
  const canVerify = hasPermission("workorders:verify");

  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);

  // ReadOnly logic based on admin approval/final state
  const isReadOnly = ["VERIFIED", "CLOSED", "CANCELLED"].includes(
    workOrder?.status || "",
  );

  const [editMode, setEditMode] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    status: "",
    priority: "",
    assignedToId: "",
  });
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [processingApproval, setProcessingApproval] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "activity" | "discussion" | "materials"
  >(() => {
    return ["COMPLETED", "CANCELLED", "VERIFIED"].includes(
      workOrder?.status || "",
    )
      ? "activity"
      : "discussion";
  });

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ImageLightbox State for completion photos
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ImageLightbox State for discussion photos
  const [discussionLightboxOpen, setDiscussionLightboxOpen] = useState(false);
  const [discussionLightboxIndex, setDiscussionLightboxIndex] = useState(0);

  // Material Detail Modal State
  const [materialDetailOpen, setMaterialDetailOpen] = useState(false);
  const [materialDetailData, setMaterialDetailData] =
    useState<MaterialDetailData | null>(null);
  const [loadingMaterialDetail, setLoadingMaterialDetail] = useState(false);
  const [addMaterialModalOpen, setAddMaterialModalOpen] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const currentUserId = (session?.user as { id?: string })?.id;

  const {
    data: workOrderResponse,
    error: workOrderError,
    mutate: refetchWorkOrder,
  } = useApi<WorkOrderDetail>(`/api/admin/workorders/${workOrderId}`);

  useEffect(() => {
    if (workOrderError?.status === 404) {
      alert("Work order tidak ditemukan");
      router.push("/admin/workorders/list");
    } else if (workOrderError) {
      clientLogger.error("Error fetching work order:", workOrderError);
      alert(
        "Terjadi kesalahan saat memuat work order: " +
          (workOrderError.message || "Kesalahan tidak diketahui"),
      );
    }
  }, [workOrderError, router]);

  const [didHydrateWO, setDidHydrateWO] = useState(false);
  if (workOrderResponse && !didHydrateWO) {
    setDidHydrateWO(true);
    setWorkOrder(workOrderResponse);
    setEditValues({
      status: workOrderResponse.status,
      priority: workOrderResponse.priority,
      assignedToId: workOrderResponse.assignedTo?.id || "",
    });
    setLoading(false);
  }

  const fetchWorkOrder = useCallback(async () => {
    const result = await refetchWorkOrder();
    if (result) {
      clientLogger.info(
        "[WorkOrder] Refetched w/ attachments:",
        result.attachments?.length,
      );
      setWorkOrder(result);
      setEditValues({
        status: result.status,
        priority: result.priority,
        assignedToId: result.assignedTo?.id || "",
      });
    }
  }, [refetchWorkOrder]);

  // Fetch material detail by updateId (MATERIAL_PICKUP/MATERIAL_RETURN)
  const fetchMaterialDetail = async (updateId: string, updateType: string) => {
    setLoadingMaterialDetail(true);
    setMaterialDetailOpen(true);
    try {
      const res = await fetch(
        `/api/admin/workorders/${workOrderId}/material-detail?updateId=${updateId}`,
      );
      if (res.ok) {
        const result = await res.json();
        setMaterialDetailData({
          ...result.data,
          type: updateType === "MATERIAL_PICKUP" ? "keluar" : "masuk",
        });
      } else {
        clientLogger.error("Failed to fetch material detail");
      }
    } catch (error) {
      clientLogger.error("Error fetching material detail:", error);
    } finally {
      setLoadingMaterialDetail(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Silakan pilih file gambar");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "work-order-updates");
      formData.append("workOrderId", workOrderId);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Gagal mengunggah gambar");
      const { url, fileName } = await uploadRes.json();

      const attachRes = await fetch(
        `/api/admin/workorders/${workOrderId}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: fileName || file.name,
            filePath: url,
            fileType: file.type,
            fileSize: file.size,
            caption: "",
          }),
        },
      );

      if (!attachRes.ok)
        throw new Error("Gagal melampirkan gambar ke work order");
      fetchWorkOrder();
    } catch (error) {
      clientLogger.error("Upload failed:", error);
      alert("Gagal mengunggah gambar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus lampiran ini?")) return;

    try {
      const res = await fetch(
        `/api/admin/workorders/${workOrderId}/attachments/${attachmentId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus attachment");
      }
      fetchWorkOrder();
    } catch (error) {
      clientLogger.error("Error deleting attachment:", error);
      alert("Gagal menghapus attachment");
    }
  };

  useRealtimeScope(workOrderId ? { kind: "workorder", id: workOrderId } : null);

  const handleNewActivity = useCallback(
    (payload: WorkOrderActivityPayload) => {
      if (payload.workOrderId !== workOrderId) return;
      clientLogger.info(
        "[WorkOrder] New activity received:",
        payload.activity.type,
      );
      fetchWorkOrder();
    },
    [workOrderId, fetchWorkOrder],
  );

  useRealtimeEvent<WorkOrderActivityPayload>(
    "workorder.activity",
    handleNewActivity,
  );

  const handleWOUpdate = useCallback(
    (payload: { id?: string; workOrderId?: string }) => {
      const updatedId = payload.id || payload.workOrderId;
      if (updatedId === workOrderId) {
        clientLogger.info("[WorkOrder] Update received, refreshing...");
        fetchWorkOrder();
      }
    },
    [workOrderId, fetchWorkOrder],
  );
  useRealtimeEvent<{ id?: string; workOrderId?: string }>(
    "workorder.update",
    handleWOUpdate,
  );

  const handleUpdateField = async (field: string) => {
    try {
      const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: editValues[field as keyof typeof editValues] || null,
        }),
      });

      if (response.ok) {
        setEditMode(null);
        fetchWorkOrder();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || "Gagal memperbarui"}`);
      }
    } catch (error) {
      clientLogger.error("Error updating:", error);
      alert("Terjadi kesalahan");
    }
  };

  const processVerify = async () => {
    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      });

      if (response.ok) {
        setShowVerifyModal(false);
        fetchWorkOrder();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal memverifikasi work order");
      }
    } catch (error) {
      clientLogger.error("Error verifying:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Silakan berikan alasan penolakan");
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          rejectionReason: rejectReason,
        }),
      });

      if (response.ok) {
        setShowRejectModal(false);
        setRejectReason("");
        fetchWorkOrder();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal menolak work order");
      }
    } catch (error) {
      clientLogger.error("Error rejecting:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert("Silakan berikan alasan pembatalan");
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${workOrderId}?reason=${encodeURIComponent(cancelReason)}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setShowCancelModal(false);
        setCancelReason("");
        fetchWorkOrder();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal membatalkan work order");
      }
    } catch (error) {
      clientLogger.error("Error cancelling:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Apakah anda yakin ingin menghapus Work Order ini secara PERMANEN? Data yang dihapus tidak dapat dikembalikan.",
      )
    ) {
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${workOrderId}?permanent=true`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        alert("Work Order berhasil dihapus permanen");
        router.push("/admin/workorders/list");
      } else {
        alert("Gagal menghapus work order");
      }
    } catch (error) {
      clientLogger.error("Error deleting:", error);
      alert("Terjadi kesalahan");
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.trim()) return;

    setAddingTask(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${workOrderId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTask }),
        },
      );

      if (response.ok) {
        setNewTask("");
        fetchWorkOrder();
      }
    } catch (error) {
      clientLogger.error("Error adding task:", error);
    } finally {
      setAddingTask(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PageLoader />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Work order not found</div>
      </div>
    );
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setAddingComment(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/${workOrderId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: newComment }),
        },
      );

      if (response.ok) {
        setNewComment("");
        fetchWorkOrder();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Gagal menambahkan komentar");
      }
    } catch (error) {
      clientLogger.error("Error adding comment:", error);
      alert("Terjadi kesalahan saat menambahkan komentar");
    } finally {
      setAddingComment(false);
    }
  };

  const completedTasks =
    workOrder.tasks?.filter((t) => t.status === "COMPLETED").length || 0;
  const totalTasks = workOrder.tasks?.length || 0;
  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Process timeline items
  const timelineItems: TimelineItem[] = [
    ...(workOrder.updates || []).map((u) => ({
      type: (u.updateType === "COMMENT" ? "comment" : "update") as
        | "comment"
        | "update",
      date: new Date(u.createdAt),
      id: u.id,
      data: u,
    })),
    ...(workOrder.attachments || [])
      .filter((a) => !a.caption?.startsWith("[COMPLETION]"))
      .map((a) => ({
        type: "attachment" as const,
        date: new Date(a.uploadedAt),
        id: a.id,
        data: a,
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const completionAttachments =
    workOrder.attachments?.filter((a) =>
      a.caption?.startsWith("[COMPLETION]"),
    ) || [];

  const timelineLogItems = timelineItems.filter(
    (item) => item.type !== "comment",
  );

  const discussionItems = timelineItems.filter(
    (item) => item.type === "comment" || item.type === "attachment",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workorders/list"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <HiArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {workOrder.workOrderNumber}
          </h1>
          <p className="text-gray-600 mt-1">{workOrder.title}</p>
        </div>
        {canCancel &&
          workOrder.status !== "CANCELLED" &&
          workOrder.status !== "CLOSED" &&
          workOrder.status !== "COMPLETED" && (
            <Button
              onClick={() => setShowCancelModal(true)}
              disabled={processingApproval}
              variant="outline"
              className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <HiXMark className="w-5 h-5" />
              Batalkan
            </Button>
          )}
        {canDelete && (
          <Button
            onClick={() => setShowDeleteModal(true)}
            disabled={processingApproval}
            variant="outline"
            className="border-red-600 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <HiXMark className="w-5 h-5" />
            Hapus
          </Button>
        )}
        {canVerify && workOrder.status === "COMPLETED" && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowRejectModal(true)}
              disabled={processingApproval}
              variant="outline"
              className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <HiXMark className="w-5 h-5" />
              Tolak
            </Button>
            <Button
              onClick={() => setShowVerifyModal(true)}
              disabled={processingApproval}
              variant="success"
            >
              <HiCheckCircle className="w-5 h-5" />
              Verifikasi
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Order Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {editMode === "status" ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editValues.status}
                      onChange={(e) =>
                        setEditValues({ ...editValues, status: e.target.value })
                      }
                      className="px-3 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                    <Button
                      onClick={() => handleUpdateField("status")}
                      variant="success"
                      size="icon-sm"
                    >
                      <HiCheck className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[workOrder.status]}`}
                    >
                      {workOrder.status.replace("_", " ")}
                    </span>
                    {!isReadOnly && canUpdate && (
                      <button
                        onClick={() => setEditMode("status")}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400"
                      >
                        <HiPencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {editMode === "priority" ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editValues.priority}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          priority: e.target.value,
                        })
                      }
                      className="px-3 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                    <Button
                      onClick={() => handleUpdateField("priority")}
                      variant="success"
                      size="icon-sm"
                    >
                      <HiCheck className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {workOrder.priority}
                    </span>
                    {!isReadOnly && canUpdate && (
                      <button
                        onClick={() => setEditMode("priority")}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400"
                      >
                        <HiPencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Type:</span>{" "}
                <span className="font-medium text-gray-900 dark:text-gray-200">
                  {workOrder.type}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Description:
                </span>
                <p className="mt-1 text-gray-900 dark:text-gray-200">
                  {workOrder.description}
                </p>
              </div>
              {workOrder.ticket && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Related Ticket:
                  </span>{" "}
                  <Link
                    href={`/admin/helpdesk/tiket/${workOrder.ticket.ticketNumber.split("-").pop()}`}
                    className="text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {workOrder.ticket.ticketNumber}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Tasks Checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tasks Checklist
              </h3>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {completedTasks}/{totalTasks} completed
              </span>
            </div>

            {totalTasks > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-sky-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {workOrder.tasks?.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                >
                  <input
                    type="checkbox"
                    checked={task.status === "COMPLETED"}
                    readOnly
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-sky-600"
                  />
                  <span
                    className={
                      task.status === "COMPLETED"
                        ? "line-through text-gray-500 dark:text-gray-500"
                        : "text-gray-900 dark:text-gray-200"
                    }
                  >
                    {task.title}
                  </span>
                </div>
              ))}
            </div>

            {!isReadOnly && canUpdate && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
                  placeholder="Add new task..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  disabled={addingTask}
                />
                <button
                  onClick={handleAddTask}
                  disabled={addingTask || !newTask.trim()}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Activity & Discussion Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Tab Headers */}
            <div className="p-4 pb-0">
              <div className="flex p-1 space-x-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                    activeTab === "activity"
                      ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  <HiClock className="w-5 h-5" />
                  Activity Timeline
                </button>
                <button
                  onClick={() => setActiveTab("discussion")}
                  className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                    activeTab === "discussion"
                      ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  <HiChatBubbleLeftRight className="w-5 h-5" />
                  Diskusi
                </button>
                <button
                  onClick={() => setActiveTab("materials")}
                  className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                    activeTab === "materials"
                      ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  <HiCube className="w-5 h-5" />
                  Material Used
                </button>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />

            <div className="p-6">
              {activeTab === "activity" && (
                <WoActivityTimeline
                  timelineLogItems={timelineLogItems}
                  currentUserId={currentUserId}
                  onFetchMaterialDetail={fetchMaterialDetail}
                  onDeleteAttachment={handleDeleteAttachment}
                />
              )}

              {activeTab === "materials" && (
                <WoMaterialsTab
                  materials={workOrder.materials}
                  isReadOnly={isReadOnly}
                  canUpdate={canUpdate}
                  onAddMaterial={() => setAddMaterialModalOpen(true)}
                />
              )}

              {activeTab === "discussion" && (
                <WoDiscussionTab
                  discussionItems={discussionItems}
                  currentUserId={currentUserId}
                  workOrderStatus={workOrder.status}
                  canUpdate={canUpdate}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  addingComment={addingComment}
                  handleAddComment={handleAddComment}
                  isUploading={isUploading}
                  fileInputRef={fileInputRef}
                  onDeleteAttachment={handleDeleteAttachment}
                  discussionLightboxOpen={discussionLightboxOpen}
                  setDiscussionLightboxOpen={setDiscussionLightboxOpen}
                  discussionLightboxIndex={discussionLightboxIndex}
                  setDiscussionLightboxIndex={setDiscussionLightboxIndex}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <WoSidebar
          workOrder={workOrder}
          completionAttachments={completionAttachments}
          lightboxOpen={lightboxOpen}
          setLightboxOpen={setLightboxOpen}
          lightboxIndex={lightboxIndex}
          setLightboxIndex={setLightboxIndex}
        />
      </div>

      {/* Action Modals */}
      <WoActionModals
        showRejectModal={showRejectModal}
        setShowRejectModal={setShowRejectModal}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        handleReject={handleReject}
        showCancelModal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        handleCancel={handleCancel}
        showVerifyModal={showVerifyModal}
        setShowVerifyModal={setShowVerifyModal}
        processVerify={processVerify}
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        handleDelete={handleDelete}
        processingApproval={processingApproval}
      />

      {/* Add Material Modal */}
      <AddMaterialModal
        isOpen={addMaterialModalOpen}
        onClose={() => setAddMaterialModalOpen(false)}
        onSuccess={() => fetchWorkOrder()}
        workOrderId={workOrderId}
      />

      {/* Material Detail Modal */}
      <WoMaterialDetailModal
        isOpen={materialDetailOpen}
        onClose={() => {
          setMaterialDetailOpen(false);
          setMaterialDetailData(null);
        }}
        data={materialDetailData}
        loading={loadingMaterialDetail}
      />
    </div>
  );
}
