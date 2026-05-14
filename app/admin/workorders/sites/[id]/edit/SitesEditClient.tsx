"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import SiteForm from "../../components/SiteForm";

interface Site {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    attendanceRadius: number;
  };
  isActive: boolean;
  gudangs: { id: string; name: string }[];
}

export function ClientComponent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    attendanceRadius: "100",
    isActive: true,
    gudangIds: [] as string[],
  });

  // Fetch existing site data
  useEffect(() => {
    const fetchSite = async () => {
      try {
        const response = await fetch(`/api/admin/sites/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gagal memuat data site");
        }

        const site: Site = data.data;
        setFormData({
          code: site.code,
          name: site.name,
          description: site.description || "",
          address: site.address || "",
          latitude: site.location.latitude?.toString() || "",
          longitude: site.location.longitude?.toString() || "",
          attendanceRadius: site.location.attendanceRadius?.toString() || "100",
          isActive: site.isActive,
          gudangIds: site.gudangs ? site.gudangs.map((g) => g.id) : [],
        });
      } catch (error: unknown) {
        clientLogger.error("Error fetching site:", error);
        setError(
          error instanceof Error ? error.message : "Gagal memuat data site",
        );
      } finally {
        setFetching(false);
      }
    };

    fetchSite();
  }, [id]);

  const handleMapChange = (lat: string, lng: string) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/sites/${id}`, {
        method: "PATCH",
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
        throw new Error(data.error || "Gagal mengupdate site");
      }

      router.push("/admin/workorders/sites");
    } catch (error: unknown) {
      clientLogger.error("Error updating site:", error);
      setError(
        error instanceof Error ? error.message : "Gagal mengupdate site",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "code"
            ? value.toUpperCase()
            : value,
    }));
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data site...
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
          href="/admin/workorders/sites"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Site
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formData.code} - {formData.name}
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
        submitLabel="Simpan Perubahan"
        showIsActive
        currentSiteId={id}
      />
    </div>
  );
}
