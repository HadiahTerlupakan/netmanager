"use client";

import Link from "next/link";
import { HiOutlineScale } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { useApi } from "@/lib/hooks/useApi";
import AddLegalDocumentButton from "./components/AddLegalDocumentButton";
import type { LegalDashboard } from "./components/legal-types";
import LegalStatCards from "./LegalStatCards";
import LegalActionItemList from "./LegalActionItemList";

/** Dasbor legal: ringkasan masa berlaku dan daftar tenggat yang perlu tindakan. */

const SECONDARY_LINK_CLASS =
  "text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400";

export default function LegalDashboardClient() {
  const { data, error, isLoading } = useApi<LegalDashboard>(
    "/api/admin/legal/dashboard",
  );
  // useApi sudah membuka amplop { success, data }.
  const dashboard = data;

  if (isLoading) return <PageLoader />;

  if (error || !dashboard) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat dasbor legal.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <HiOutlineScale className="h-6 w-6" />
            Dasbor Legal
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Kontrak, izin, sewa lahan, dan dokumen korporat beserta masa
            berlakunya.
          </p>
          <div className="mt-2 flex gap-4">
            <Link href="/admin/legal/dokumen" className={SECONDARY_LINK_CLASS}>
              Semua dokumen
            </Link>
            <Link href="/admin/legal/kategori" className={SECONDARY_LINK_CLASS}>
              Kategori
            </Link>
          </div>
        </div>
        <AddLegalDocumentButton />
      </div>

      <LegalStatCards dashboard={dashboard} />
      <LegalActionItemList items={dashboard.actionItems} />
    </div>
  );
}
