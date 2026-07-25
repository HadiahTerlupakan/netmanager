"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import SlaForm, { type SlaFormData } from "../../components/SlaForm";
import { useApi } from "@/lib/hooks/useApi";

interface SlaDetail {
  id: string;
  name: string;
  description: string | null;
  workOrderType: string | null;
  priority: string | null;
  departmentId: string | null;
  responseTime: number;
  resolutionTime: number;
  businessHoursOnly: boolean;
  isActive: boolean;
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

  const [formData, setFormData] = useState<SlaFormData>({
    name: "",
    description: "",
    workOrderType: "",
    priority: "",
    departmentId: "",
    responseTime: 60,
    resolutionTime: 480,
    businessHoursOnly: true,
    isActive: true,
  });

  const {
    data: sla,
    isLoading: fetching,
    error: fetchError,
  } = useApi<SlaDetail>(`/api/admin/workorders/slas/${id}`);

  const fetchErrorMessage = fetchError
    ? fetchError.message || "Gagal memuat data SLA"
    : null;
  const displayError = error ?? fetchErrorMessage;

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Error fetching SLA:", fetchError);
    }
  }, [fetchError]);

  const [didHydrate, setDidHydrate] = useState(false);
  if (sla && !didHydrate) {
    setDidHydrate(true);
    setFormData({
      name: sla.name,
      description: sla.description ?? "",
      workOrderType: sla.workOrderType ?? "",
      priority: sla.priority ?? "",
      departmentId: sla.departmentId ?? "",
      responseTime: sla.responseTime,
      resolutionTime: sla.resolutionTime,
      businessHoursOnly: sla.businessHoursOnly,
      isActive: sla.isActive,
    });
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        workOrderType: formData.workOrderType || undefined,
        priority: formData.priority || undefined,
        departmentId: formData.departmentId || undefined,
        responseTime: Number(formData.responseTime),
        resolutionTime: Number(formData.resolutionTime),
        businessHoursOnly: formData.businessHoursOnly,
        isActive: formData.isActive,
      };

      const response = await fetch(`/api/admin/workorders/slas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memperbarui aturan SLA");
      }

      router.push("/admin/workorders/slas");
    } catch (submitError: unknown) {
      clientLogger.error("Error updating SLA:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal memperbarui aturan SLA",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
            ? value === ""
              ? 0
              : Number(value)
            : value,
    }));
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data SLA...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workorders/slas"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Aturan SLA
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

      <SlaForm
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Simpan Perubahan"
      />
    </div>
  );
}
