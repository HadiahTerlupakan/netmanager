"use client";

import { useState } from "react";
import Link from "next/link";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/hooks/useApi";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import { clientLogger } from "@/lib/client-logger";

interface Announcement {
  id: string;
  title: string;
  content: string;
  target: "ALL" | "CUSTOMER" | "EMPLOYEE" | "ADMIN";
  isActive: boolean;
  isPinned: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count?: {
    reads: number;
  };
}

const TARGET_BADGE_CLASS: Record<Announcement["target"], string> = {
  ALL: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  CUSTOMER:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  EMPLOYEE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function AnnouncementIndexClient() {
  const { showToast } = useToast();
  const {
    data: announcements,
    isLoading,
    mutate,
  } = useApi<Announcement[]>("/api/announcements");

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;

    setIsDeleting(true);
    try {
      const res = await fetchWithHandling(
        `/api/announcements/${pendingDeleteId}`,
        { method: "DELETE" },
      );
      if (!res.success) {
        throw new Error(res.error || "Gagal menghapus pengumuman");
      }
      showToast("success", "Pengumuman berhasil dihapus");
      await mutate();
    } catch (error) {
      clientLogger.error("Failed to delete announcement", error);
      const message =
        error instanceof Error ? error.message : "Gagal menghapus pengumuman";
      showToast("error", message);
    } finally {
      setIsDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Judul",
      priority: "primary",
      render: (announcement) => (
        <>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {announcement.title}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
            {announcement.content}
          </div>
        </>
      ),
    },
    {
      key: "target",
      header: "Target",
      priority: "secondary",
      render: (announcement) => (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${TARGET_BADGE_CLASS[announcement.target]}`}
        >
          {announcement.target}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "secondary",
      render: (announcement) => (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            announcement.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {announcement.isActive ? "Aktif" : "Non-aktif"}
        </span>
      ),
    },
    {
      key: "reads",
      header: "Dibaca",
      priority: "tertiary",
      render: (announcement) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {announcement._count?.reads || 0}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            orang
          </span>
        </div>
      ),
    },
    {
      key: "startDate",
      header: "Periode",
      priority: "tertiary",
      render: (announcement) => (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {announcement.startDate
            ? new Date(announcement.startDate).toLocaleDateString("id-ID")
            : "Sekarang"}
          {announcement.endDate
            ? ` - ${new Date(announcement.endDate).toLocaleDateString("id-ID")}`
            : " - Tanpa batas"}
        </div>
      ),
    },
  ];

  const renderActions = (announcement: Announcement) => (
    <div className="text-right text-sm font-medium">
      <Link
        href={`/admin/announcement/${announcement.id}`}
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4"
      >
        Edit
      </Link>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setPendingDeleteId(announcement.id)}
      >
        Hapus
      </Button>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Pengumuman</h1>
        <Link href="/admin/announcement/create">
          <Button>Buat Pengumuman</Button>
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <ResponsiveTable
          data={announcements ?? []}
          columns={columns}
          keyField="id"
          loading={isLoading}
          emptyMessage="Belum ada pengumuman"
          loadingMessage="Memuat pengumuman..."
          renderActions={renderActions}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Hapus Pengumuman"
        description="Apakah Anda yakin ingin menghapus pengumuman ini? Tindakan ini tidak dapat dibatalkan."
        confirmText={isDeleting ? "Menghapus..." : "Ya, hapus"}
        cancelText="Batal"
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setPendingDeleteId(null)}
      />
    </div>
  );
}
