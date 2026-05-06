"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Button } from "@/components/ui/Button";

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

export function ClientComponent() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data);
    } catch (error) {
      clientLogger.error("Failed to fetch announcements", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      fetchAnnouncements();
    } catch (error) {
      clientLogger.error("Failed to delete", error);
    }
  };

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Title",
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
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${
                      announcement.target === "ALL"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                        : announcement.target === "CUSTOMER"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : announcement.target === "ADMIN"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
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
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${announcement.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}
        >
          {announcement.isActive ? "Active" : "Inactive"}
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
      header: "Dates",
      priority: "tertiary",
      render: (announcement) => (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {announcement.startDate
            ? new Date(announcement.startDate).toLocaleDateString()
            : "Now"}
          {announcement.endDate
            ? ` - ${new Date(announcement.endDate).toLocaleDateString()}`
            : " - Forever"}
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
        variant="ghost"
        size="sm"
        onClick={() => handleDelete(announcement.id)}
        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
      >
        Delete
      </Button>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Announcements</h1>
        <Link
          href="/admin/announcement/create"
          className="bg-blue-600 dark:bg-blue-500 dark:bg-blue-400 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-400 font-medium"
        >
          <span className="text-white">Create Announcement</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <ResponsiveTable
          data={announcements}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="No announcements found"
          loadingMessage="Loading announcements..."
          renderActions={renderActions}
        />
      </div>
    </div>
  );
}
