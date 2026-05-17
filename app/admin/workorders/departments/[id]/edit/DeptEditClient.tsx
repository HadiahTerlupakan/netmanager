"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import DepartmentForm from "../../components/DepartmentForm";
import { useApi } from "@/lib/hooks/useApi";

interface Department {
  id: string;
  name: string;
  description: string | null;
  jobDescription: string | null;
  isReminderTarget: boolean;
  showInMobileWO: boolean;
}

export function ClientComponent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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

  const {
    data: dept,
    isLoading: fetching,
    error: fetchError,
  } = useApi<Department>(`/api/admin/departments/${id}`);

  const fetchErrorMessage = fetchError
    ? fetchError.message || "Gagal memuat data department"
    : null;
  const displayError = error ?? fetchErrorMessage;

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Error fetching department:", fetchError);
    }
  }, [fetchError]);

  const [didHydrate, setDidHydrate] = useState(false);
  if (dept && !didHydrate) {
    setDidHydrate(true);
    setFormData({
      name: dept.name,
      description: dept.description || "",
      jobDescription: dept.jobDescription || "",
      isReminderTarget: dept.isReminderTarget || false,
      showInMobileWO: dept.showInMobileWO || false,
    });
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/departments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengupdate department");
      }

      router.push("/admin/workorders/departments");
    } catch (error: unknown) {
      clientLogger.error("Error updating department:", error);
      setError(
        error instanceof Error ? error.message : "Gagal mengupdate department",
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data department...
          </p>
        </div>
      </div>
    );
  }

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
            Edit Department
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formData.name}
          </p>
        </div>
      </div>

      {displayError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {displayError}
        </div>
      )}

      <DepartmentForm
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Simpan Perubahan"
      />
    </div>
  );
}
