import Link from "next/link";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  HiArrowPathRoundedSquare,
  HiOutlineEye,
  HiPencil,
  HiPrinter,
  HiTrash,
  HiArrowPath,
  HiNoSymbol,
  HiXMark,
  HiArrowTrendingUp,
} from "react-icons/hi2";
import type { Column } from "@/components/ui/ResponsiveTable";

export type PelangganPPP = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  tipe: "REGULER" | "NON_REGULER";
  hargaPaketId: string;
  hargaPaket?: {
    id: string;
    name: string;
    harga: number;
  } | null;
  site?: {
    name: string;
  } | null;
  pendingPackage?: {
    id: string;
    name: string;
  } | null;
  pendingPackageApplyAt?: string | null;
  tanggalAktif: string;
  jatuhTempo: string;
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
  alamat?: string | null;
  noTelp?: string | null;
  email?: string | null;
  createdAt: string;
};

export function createPppListColumns(
  disableDuration: number,
): Column<PelangganPPP>[] {
  return [
    {
      key: "nama",
      header: "Nama Pelanggan",
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {item.nama}
          </div>
          <div className="text-sm text-gray-500 font-mono mt-0.5">
            {item.idPelanggan}
          </div>
          <div className="md:hidden text-xs text-gray-400 mt-1">
            {item.hargaPaket?.name || "-"}
          </div>
        </div>
      ),
      priority: "primary",
    },
    {
      key: "hargaPaket.name",
      header: "Paket / Biaya",
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {item.hargaPaket?.name || "-"}{" "}
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({item.tipe})
            </span>
          </div>
          <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            }).format(item.hargaPaket?.harga || 0)}
          </div>
          {item.pendingPackage && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300 ring-1 ring-teal-600/20">
              <HiArrowTrendingUp className="w-3.5 h-3.5" />
              Upgrade ke {item.pendingPackage.name}
              {item.pendingPackageApplyAt
                ? ` • ${new Date(item.pendingPackageApplyAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
                : ""}
            </div>
          )}
        </div>
      ),
      priority: "secondary",
    },
    {
      key: "site.name",
      header: "Site Area",
      render: (item: PelangganPPP) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {item.site?.name || "-"}
        </span>
      ),
      priority: "tertiary",
    },
    {
      key: "tanggalAktif",
      header: "Masa Aktif",
      render: (item: PelangganPPP) => {
        const dueDate = new Date(item.jatuhTempo);
        const diffDays = Math.ceil(
          (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );

        let statusColor = "text-white bg-emerald-600 dark:bg-emerald-500";
        let statusText = `${diffDays} hari lagi`;

        if (diffDays < 0) {
          statusColor = "text-white bg-rose-600 dark:bg-rose-500";
          statusText = `Telat ${Math.abs(diffDays)} hari`;
        } else if (diffDays <= disableDuration) {
          statusColor = "text-white bg-amber-600 dark:bg-amber-500";
          statusText = `${diffDays} hari (Akan Habis)`;
        }

        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              Exp:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {dueDate.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div
              className={`text-xs font-bold ${statusColor} px-2 py-1 rounded-full inline-block`}
            >
              {statusText}
            </div>
          </div>
        );
      },
      priority: "secondary",
    },
    {
      key: "status",
      header: "Status",
      render: (item: PelangganPPP) => <StatusBadge status={item.status} />,
      priority: "primary",
      mobileLabel: "Status",
    },
  ] as Column<PelangganPPP>[];
}

export function renderPppListActions(
  item: PelangganPPP,
  allowed: boolean,
  disableDuration: number,
  onDelete: (id: string) => void,
  onStatusUpdate: (id: string, newStatus: string, actionName: string) => void,
) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {item.status !== "ISOLIR" && (
        <button
          onClick={() => onStatusUpdate(item.id, "ISOLIR", "ISOLIR")}
          title="Isolir (Blokir Akses)"
          className="p-2 text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:text-orange-400 rounded-lg transition-colors"
        >
          <HiNoSymbol className="w-4 h-4" />
        </button>
      )}
      {item.status !== "DISMANTLE" && (
        <button
          onClick={() => onStatusUpdate(item.id, "DISMANTLE", "DISMANTLE")}
          title="Dismantle (Berhenti Langganan)"
          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg transition-colors"
        >
          <HiXMark className="w-4 h-4" />
        </button>
      )}
      {["ISOLIR", "DISMANTLE", "NONAKTIF"].includes(item.status) && (
        <button
          onClick={() => onStatusUpdate(item.id, "AKTIF", "AKTIF")}
          title="Aktifkan Kembali"
          className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg transition-colors"
        >
          <HiArrowPath className="w-4 h-4" />
        </button>
      )}

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

      <button
        onClick={() =>
          allowed
            ? (window.location.href = `/admin/pelanggan/ppp/${item.id}/renew`)
            : null
        }
        disabled={!allowed}
        title={
          allowed
            ? "Perpanjang Layanan"
            : `Bisa diperpanjang ${disableDuration} hari sebelum jatuh tempo`
        }
        className={`p-2 rounded-lg transition-colors ${allowed ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400" : "text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60"}`}
      >
        <HiArrowPathRoundedSquare className="w-4 h-4" />
      </button>
      <button
        onClick={() =>
          window.open(
            `/admin/pelanggan/ppp/${item.id}/print`,
            "_blank",
            "noopener,noreferrer",
          )
        }
        title="Cetak Tagihan"
        className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 dark:text-purple-400 rounded-lg transition-colors"
      >
        <HiPrinter className="w-4 h-4" />
      </button>
      <Link
        href={`/admin/pelanggan/ppp/${item.id}`}
        title="Detail Pelanggan"
        className="p-2 text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:text-teal-400 rounded-lg transition-colors"
      >
        <HiOutlineEye className="w-4 h-4" />
      </Link>
      <Link
        href={`/admin/pelanggan/ppp/${item.id}/edit`}
        title="Edit Pelanggan"
        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 rounded-lg transition-colors"
      >
        <HiPencil className="w-4 h-4" />
      </Link>
      <button
        onClick={() => onDelete(item.id)}
        title="Hapus Pelanggan"
        className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg transition-colors"
      >
        <HiTrash className="w-4 h-4" />
      </button>
    </div>
  );
}
