"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import SlaForm, { type SlaFormData } from "../components/SlaForm";

export function ClientComponent() {
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

      const response = await fetch("/api/admin/workorders/slas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat aturan SLA");
      }

      router.push("/admin/workorders/slas");
    } catch (submitError: unknown) {
      clientLogger.error("Error creating SLA:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat aturan SLA",
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
            Tambah Aturan SLA
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tetapkan target response &amp; resolution time untuk work order.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <SlaForm
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Simpan Aturan SLA"
      />
    </div>
  );
}
