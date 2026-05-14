"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import DepartmentForm from "../components/DepartmentForm";

export function ClientComponent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    jobDescription: "",
    isReminderTarget: false,
    showInMobileWO: false,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat department");
      }

      router.push("/admin/workorders/departments");
    } catch (error: unknown) {
      clientLogger.error("Error creating department:", error);
      setError(
        error instanceof Error ? error.message : "Gagal membuat department",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workorders/departments"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Department Baru
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Buat departemen baru untuk Work Orders
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <DepartmentForm
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Simpan Department"
      />
    </div>
  );
}
