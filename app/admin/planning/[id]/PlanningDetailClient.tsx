"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlinePlay,
  HiOutlineXCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineDocumentText,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCube,
  HiOutlineArrowDownTray,
} from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { useInvalidatePlanningRelated } from "@/lib/hooks/useInvalidate";
import { formatApiError } from "@/lib/utils/api-response-parser";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import MapPicker from "@/components/common/MapPicker";
import { downloadPlanningPdf } from "../planning-pdf";
import {
  PLANNING_STATUS_CONFIG,
  MILESTONE_STATUS_CONFIG,
  formatBudget,
  formatDateShort,
} from "@/modules/planning/client";
import type { PlanningDetailDTO } from "@/modules/planning/client";
import type { PlanningStatus } from "@/modules/planning/client";
import { resolvePlanningActions } from "@/modules/planning/client";

type Tab = "overview" | "items" | "milestones" | "documents";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <HiOutlineDocumentText className="w-4 h-4" />,
  },
  {
    key: "items",
    label: "Material",
    icon: <HiOutlineCube className="w-4 h-4" />,
  },
  {
    key: "milestones",
    label: "Milestone",
    icon: <HiOutlineClipboardDocumentCheck className="w-4 h-4" />,
  },
  {
    key: "documents",
    label: "Dokumen",
    icon: <HiOutlineDocumentText className="w-4 h-4" />,
  },
];

export default function PlanningDetailClient({
  planningId,
}: {
  planningId: string;
}) {
  const router = useRouter();
  // Meng-invalidate seluruh cache modul, bukan hanya key detail: daftar,
  // kanban, dan dashboard ikut berubah oleh setiap aksi di halaman ini.
  const invalidatePlanning = useInvalidatePlanningRelated();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("planning:update");
  const canDelete = hasPermission("planning:delete");
  const canApprove = hasPermission("planning:approve");
  const canSubmit = hasPermission("planning:approve_request");

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: planning, isLoading } = useApi<PlanningDetailDTO>(
    `/api/planning/${planningId}`,
    {
      onError: () => toast.error("Gagal memuat detail planning"),
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!planning) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Planning tidak ditemukan
        </p>
        <Link href="/admin/planning/daftar" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Kembali ke Daftar
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig =
    PLANNING_STATUS_CONFIG[planning.status as PlanningStatus];
  // Aturan aksi dipusatkan di domain supaya halaman tidak menyimpang darinya —
  // versi inline sebelumnya menyembunyikan tombol Ajukan pada rencana yang
  // ditolak, sehingga rencana itu bisa diperbaiki tetapi tidak bisa diajukan lagi.
  const actions = resolvePlanningActions(planning.status as PlanningStatus, {
    canUpdate,
    canSubmit,
    canApprove,
    canDelete,
  });

  const handleStatusAction = async (
    action: "submit" | "approve" | "reject" | "start" | "complete",
  ) => {
    if (action === "reject" && !approvalNotes.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const body =
        action === "submit" || action === "start" || action === "complete"
          ? {}
          : { approvalNotes: approvalNotes.trim() || null };

      const res = await fetch(`/api/planning/${planningId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          action === "submit"
            ? "Planning diajukan untuk approval"
            : action === "approve"
              ? "Planning disetujui"
              : "Planning ditolak",
        );
        setShowApprove(false);
        setShowReject(false);
        setApprovalNotes("");
        invalidatePlanning();
      } else {
        toast.error(formatApiError(data, `Gagal ${action}`));
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/planning/${planningId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Planning dihapus");
        // Invalidate sebelum berpindah: tanpa ini halaman daftar yang dituju
        // masih merender rencana yang baru saja dihapus dari cache lama.
        invalidatePlanning();
        router.push("/admin/planning/daftar");
      } else {
        const data = await res.json();
        toast.error(formatApiError(data, "Gagal menghapus"));
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/planning/daftar">
            <Button variant="ghost" size="icon">
              <HiOutlineArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {planning.title}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {planning.area} · {planning.estimatedUnits} unit ·{" "}
              {formatBudget(planning.estimatedBudget)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions.canEdit && (
            <Link href={`/admin/planning/${planningId}/edit`}>
              <Button variant="outline" size="sm">
                <HiOutlinePencilSquare className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          )}
          {/* Memakai `planning` yang sudah ada di memori, bukan mengambil
              ulang detail yang sama dari server. Halaman ini baru saja
              memuatnya; request kedua hanya menambah jeda tanpa indikasi apa
              pun di tombol. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                downloadPlanningPdf(planning);
              } catch {
                toast.error("Gagal generate PDF");
              }
            }}
          >
            <HiOutlineArrowDownTray className="w-4 h-4" />
            Export PDF
          </Button>
          {actions.canSubmit && (
            <Button
              size="sm"
              loading={submitting}
              onClick={() => handleStatusAction("submit")}
            >
              <HiOutlinePaperAirplane className="w-4 h-4" />
              {planning.status === "REJECTED" ? "Ajukan ulang" : "Ajukan"}
            </Button>
          )}
          {actions.canStart && (
            <Button
              size="sm"
              loading={submitting}
              onClick={() => handleStatusAction("start")}
            >
              <HiOutlinePlay className="w-4 h-4" />
              Mulai pengerjaan
            </Button>
          )}
          {actions.canComplete && (
            <Button
              variant="success"
              size="sm"
              loading={submitting}
              onClick={() => handleStatusAction("complete")}
            >
              <HiOutlineCheckCircle className="w-4 h-4" />
              Tandai selesai
            </Button>
          )}
          {actions.canApprove && (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => setShowApprove(true)}
              >
                <HiOutlineCheckCircle className="w-4 h-4" />
                Setujui
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowReject(true)}
              >
                <HiOutlineXCircle className="w-4 h-4" />
                Tolak
              </Button>
            </>
          )}
          {actions.canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowDelete(true)}
            >
              <HiOutlineTrash className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === "items" && planning.items.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                  {planning.items.length}
                </span>
              )}
              {tab.key === "milestones" && planning.milestones.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                  {planning.milestones.length}
                </span>
              )}
              {tab.key === "documents" && planning.documents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                  {planning.documents.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab planning={planning} />}
      {activeTab === "items" && (
        <ItemsTab planning={planning} canEditItems={actions.canEdit} />
      )}
      {activeTab === "milestones" && (
        <MilestonesTab planning={planning} canUpdate={canUpdate} />
      )}
      {activeTab === "documents" && (
        <DocumentsTab planning={planning} canUpdate={canUpdate} />
      )}

      {/* Approve dialog */}
      {showApprove && (
        <ApproveRejectDialog
          mode="approve"
          notes={approvalNotes}
          setNotes={setApprovalNotes}
          submitting={submitting}
          onCancel={() => {
            setShowApprove(false);
            setApprovalNotes("");
          }}
          onConfirm={() => handleStatusAction("approve")}
        />
      )}

      {/* Reject dialog */}
      {showReject && (
        <ApproveRejectDialog
          mode="reject"
          notes={approvalNotes}
          setNotes={setApprovalNotes}
          submitting={submitting}
          onCancel={() => {
            setShowReject(false);
            setApprovalNotes("");
          }}
          onConfirm={() => handleStatusAction("reject")}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDelete}
        title="Hapus Planning"
        description={`Yakin ingin menghapus "${planning.title}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmText="Hapus"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────
function OverviewTab({ planning }: { planning: PlanningDetailDTO }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Deskripsi
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {planning.description || "Tidak ada deskripsi"}
          </p>
        </div>

        {planning.coordinates && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Lokasi GPS
            </h3>
            <MapPicker
              lat={planning.coordinates.latitude}
              lon={planning.coordinates.longitude}
              height={320}
              onChange={() => {}}
            />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Detail
          </h3>
          {planning.hasBudgetMismatch && (
            <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              Total item BOQ berbeda dari anggaran rencana. Periksa daftar item
              atau perbarui anggarannya.
            </p>
          )}
          <dl className="space-y-2.5 text-sm">
            <DetailRow label="Tipe" value={planning.type} />
            <DetailRow
              label="Approval Level"
              value={planning.approvalLevel === 2 ? "2 Level" : "1 Level"}
            />
            <DetailRow
              label="Progres tercatat"
              value={`${planning.progressPercentage}%`}
            />
            {planning.milestoneProgressPercentage !== null && (
              <DetailRow
                label="Progres milestone"
                value={`${planning.milestoneProgressPercentage}% selesai`}
              />
            )}
            <DetailRow
              label="Anggaran rencana"
              value={formatBudget(planning.estimatedBudget)}
            />
            <DetailRow
              label="Total item (BOQ)"
              value={formatBudget(planning.itemsTotalEstimatedCost)}
            />
            <DetailRow
              label="Realisasi"
              value={formatBudget(planning.actualBudget)}
            />
            <DetailRow
              label="Tanggal Mulai"
              value={formatDateShort(planning.startDate)}
            />
            <DetailRow
              label="Target Selesai"
              value={formatDateShort(planning.targetCompletionDate)}
            />
            <DetailRow
              label="Dibuat"
              value={formatDateShort(planning.createdAt)}
            />
          </dl>
        </div>

        {planning.approvalNotes && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Catatan Approval
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {planning.approvalNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

// ─── Items Tab ────────────────────────────────────────────────────────────
/**
 * Tab material (BOQ).
 *
 * `canEditItems` sengaja BUKAN sekadar permission `planning:update`, melainkan
 * `actions.canEdit` — permission DAN status yang masih boleh diubah. BOQ ikut
 * terkunci begitu rencana diajukan. Sebelumnya tombol "+ Tambah Item" dan ikon
 * hapus muncul di rencana berstatus APPROVED: pengguna mengisi empat kolom,
 * menekan Simpan, lalu mendapat pesan penolakan dari server — antarmuka
 * menawarkan aksi yang tidak pernah mungkin berhasil.
 */
function ItemsTab({
  planning,
  canEditItems,
}: {
  planning: PlanningDetailDTO;
  canEditItems: boolean;
}) {
  // Meng-invalidate seluruh cache modul, bukan hanya key detail: daftar,
  // kanban, dan dashboard ikut berubah oleh setiap aksi di halaman ini.
  const invalidatePlanning = useInvalidatePlanningRelated();
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    unit: "meter",
    estimatedPrice: "",
  });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newItem.name.trim() || !newItem.quantity) {
      toast.error("Nama dan jumlah wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/planning/${planning.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.name.trim(),
          quantity: Number(newItem.quantity),
          unit: newItem.unit,
          estimatedPrice: newItem.estimatedPrice
            ? Number(newItem.estimatedPrice)
            : null,
        }),
      });
      if (res.ok) {
        toast.success("Item ditambahkan");
        setNewItem({
          name: "",
          quantity: "",
          unit: "meter",
          estimatedPrice: "",
        });
        setAdding(false);
        invalidatePlanning();
      } else {
        const data = await res.json();
        toast.error(formatApiError(data, "Gagal menambah item"));
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/planning/${planning.id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Item dihapus");
        invalidatePlanning();
      } else {
        toast.error(formatApiError(await res.json(), "Gagal menghapus item"));
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {canEditItems && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Material Items
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(!adding)}
          >
            {adding ? "Batal" : "+ Tambah Item"}
          </Button>
        </div>
      )}

      {adding && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              placeholder="Nama material"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Jumlah"
              value={newItem.quantity}
              onChange={(e) =>
                setNewItem({ ...newItem, quantity: e.target.value })
              }
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="meter">meter</option>
              <option value="pcs">pcs</option>
              <option value="unit">unit</option>
              <option value="roll">roll</option>
              <option value="box">box</option>
            </select>
            <input
              type="number"
              placeholder="Harga estimasi"
              value={newItem.estimatedPrice}
              onChange={(e) =>
                setNewItem({ ...newItem, estimatedPrice: e.target.value })
              }
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button size="sm" loading={saving} onClick={handleAdd}>
            Simpan Item
          </Button>
        </div>
      )}

      {planning.items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Belum ada material item
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  Nama
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Qty
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  Satuan
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Harga
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Total
                </th>
                {canEditItems && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {planning.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {formatBudget(item.estimatedPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                    {formatBudget(item.totalEstimated)}
                  </td>
                  {canEditItems && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Milestones Tab ───────────────────────────────────────────────────────
function MilestonesTab({
  planning,
  canUpdate,
}: {
  planning: PlanningDetailDTO;
  canUpdate: boolean;
}) {
  // Meng-invalidate seluruh cache modul, bukan hanya key detail: daftar,
  // kanban, dan dashboard ikut berubah oleh setiap aksi di halaman ini.
  const invalidatePlanning = useInvalidatePlanningRelated();

  const handleMilestoneStatus = async (milestoneId: string, status: string) => {
    try {
      const res = await fetch(`/api/planning/${planning.id}/milestones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestones: [
            {
              id: milestoneId,
              status,
              actualDate:
                status === "COMPLETED" ? new Date().toISOString() : null,
            },
          ],
        }),
      });
      if (res.ok) {
        toast.success("Status milestone diperbarui");
        invalidatePlanning();
      } else {
        toast.error(
          formatApiError(await res.json(), "Gagal memperbarui milestone"),
        );
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  return (
    <div className="space-y-3">
      {planning.milestones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-400">
            Belum ada milestone. Milestone default dibuat saat planning
            disetujui.
          </p>
        </div>
      ) : (
        planning.milestones.map((ms) => {
          const config =
            MILESTONE_STATUS_CONFIG[
              ms.status as keyof typeof MILESTONE_STATUS_CONFIG
            ];
          return (
            <div
              key={ms.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {ms.name}
                  </p>
                </div>
                {ms.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4">
                    {ms.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 ml-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Target: {formatDateShort(ms.targetDate)}</span>
                  {ms.actualDate && (
                    <span>Aktual: {formatDateShort(ms.actualDate)}</span>
                  )}
                  {ms.isOverdue && (
                    <span className="text-red-600 dark:text-red-400">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}
                >
                  {config.label}
                </span>
                {canUpdate && ms.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMilestoneStatus(ms.id, "COMPLETED")}
                  >
                    Selesai
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────
function DocumentsTab({
  planning,
  canUpdate,
}: {
  planning: PlanningDetailDTO;
  canUpdate: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Dokumen
      </h3>
      {planning.documents.length === 0 ? (
        <div className="py-10 text-center">
          <HiOutlineDocumentText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">
            Belum ada dokumen
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {canUpdate
              ? "Unggah dokumen belum tersedia di aplikasi. Sertakan gambar kerja, izin, dan berita acara lewat kanal yang berlaku sampai fitur ini dibuka."
              : "Dokumen pendukung akan tampil di sini setelah dilampirkan."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planning.documents.map((doc) => (
            <a
              key={doc.id}
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <HiOutlineDocumentText className="w-8 h-8 text-indigo-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {doc.category} · {doc.formattedFileSize ?? "-"}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Approve/Reject Dialog ───────────────────────────────────────────────
function ApproveRejectDialog({
  mode,
  notes,
  setNotes,
  submitting,
  onCancel,
  onConfirm,
}: {
  mode: "approve" | "reject";
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {mode === "approve" ? "Setujui Planning" : "Tolak Planning"}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {mode === "approve"
            ? "Tambahkan catatan approval (opsional):"
            : "Wajib berikan alasan penolakan:"}
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={
            mode === "approve" ? "Catatan..." : "Alasan penolakan..."
          }
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Batal
          </Button>
          <Button
            variant={mode === "approve" ? "success" : "destructive"}
            size="sm"
            loading={submitting}
            onClick={onConfirm}
          >
            {mode === "approve" ? "Setujui" : "Tolak"}
          </Button>
        </div>
      </div>
    </div>
  );
}
