import type { ChangeEvent } from "react";
import Link from "next/link";
import { HiOutlineMagnifyingGlass, HiOutlinePlus } from "react-icons/hi2";
import { SiteFilter } from "@/components/common/SiteFilter";
import { buttonVariants } from "@/components/ui/Button";
import { SEARCH_INPUT_LABEL } from "./CanvasingListTypes";

interface CanvasingListHeaderProps {
  canCreate: boolean;
  search: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSiteChange: (siteId?: string) => void;
}

/** Render canvasing page header, filters, and search controls. */
export default function CanvasingListHeader({
  canCreate,
  search,
  onSearchChange,
  onSiteChange,
}: CanvasingListHeaderProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Daftar Canvasing
        </h1>
        <p className="text-sm text-gray-500">
          Kelola dan verifikasi request instalasi dari lapangan
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3 md:w-auto md:flex-row">
        <div className="w-full md:w-48">
          <SiteFilter onSiteChange={onSiteChange} />
        </div>
        {canCreate && (
          <Link
            href="/admin/marketing/canvasing/new"
            aria-label="Tambah canvasing baru"
            className={`${buttonVariants({ variant: "default", size: "default" })} !text-white`}
          >
            <HiOutlinePlus className="h-5 w-5" />
            Tambah Canvasing
          </Link>
        )}
        <div className="relative w-full md:w-64">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama atau alamat..."
            aria-label={SEARCH_INPUT_LABEL}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
            value={search}
            onChange={onSearchChange}
          />
        </div>
      </div>
    </div>
  );
}
