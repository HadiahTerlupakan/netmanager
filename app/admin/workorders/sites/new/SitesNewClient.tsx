"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import SiteForm from "../components/SiteForm";

export function ClientComponent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    attendanceRadius: "100",
    gudangIds: [] as string[],
  });

  const handleMapChange = (lat: string, lng: string) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          attendanceRadius: parseInt(formData.attendanceRadius) || 100,
          gudangIds: formData.gudangIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat site");
      }

      router.push("/admin/workorders/sites");
    } catch (error: unknown) {
      clientLogger.error("Error creating site:", error);
      setError(error instanceof Error ? error.message : "Gagal membuat site");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "code" ? value.toUpperCase() : value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workorders/sites"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Site Baru
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Buat lokasi/area baru untuk Work Orders
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <SiteForm
        formData={formData}
        onChange={handleChange}
        onMapChange={handleMapChange}
        onGudangChange={(ids) =>
          setFormData((prev) => ({ ...prev, gudangIds: ids }))
        }
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Simpan Site"
      />
    </div>
  );
}
