"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { GudangForm } from "@/components/inventory/GudangForm";
import { useApi } from "@/lib/hooks/useApi";

interface Gudang {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type GudangPayload = Gudang | { gudang?: Gudang };

export function GudangEditClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [gudangId, setGudangId] = useState<string | null>(null);

  useEffect(() => {
    async function getParams() {
      const { id } = await params;
      setGudangId(id);
    }
    getParams();
  }, [params]);

  const {
    data: rawGudang,
    error,
    isLoading,
  } = useApi<GudangPayload>(
    gudangId ? `/api/inventory/gudang/${gudangId}` : null,
    {
      onError: (err) => {
        clientLogger.error("Failed to fetch gudang:", err);
      },
    },
  );

  const gudang = useMemo<Gudang | null>(() => {
    if (!rawGudang) return null;
    if (
      typeof rawGudang === "object" &&
      "gudang" in rawGudang &&
      rawGudang.gudang
    ) {
      return rawGudang.gudang;
    }
    return rawGudang as Gudang;
  }, [rawGudang]);

  // Loading: still resolving params, OR query is loading
  const loading = !gudangId || isLoading;

  const handleSuccess = () => {
    router.push("/admin/inventory/gudang");
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data gudang...
          </p>
        </div>
      </div>
    );
  }

  if (error || !gudang) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Link
            href="/admin/inventory/gudang"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Gudang
            </h1>
          </div>
        </div>

        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {error?.message || "Gudang tidak ditemukan"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link
          href="/admin/inventory/gudang"
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Gudang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ubah informasi lokasi gudang
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <GudangForm
            initialData={gudang}
            onSubmit={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
