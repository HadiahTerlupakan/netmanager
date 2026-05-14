"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { BarangForm } from "@/components/inventory/BarangForm";

export function BarangNewClient() {
  const router = useRouter();

  const handleSubmit = async () => {
    // Redirect to inventory page after successful submission
    router.push("/admin/inventory");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link
          href="/admin/inventory"
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Barang Baru
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Masukkan informasi barang baru ke sistem
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Informasi Barang
          </h2>
        </div>
        <div className="p-6">
          <BarangForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/admin/inventory")}
          />
        </div>
      </div>
    </div>
  );
}
