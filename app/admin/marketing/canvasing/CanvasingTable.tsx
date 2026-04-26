import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  HiOutlineArrowUturnLeft,
  HiOutlineEye,
  HiOutlineGift,
  HiOutlinePencilSquare,
  HiOutlineTrash,
} from "react-icons/hi2";
import { StatusBadge } from "@/components/common/StatusBadge";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { Button } from "@/components/ui/Button";
import type { CanvasingItem } from "./CanvasingListTypes";
import { getApprovedClaim, getPendingClaim } from "./CanvasingListTypes";

interface CanvasingTableProps {
  items: CanvasingItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  canUpdate: boolean;
  canReview: boolean;
  canDelete: boolean;
  onPageChange: (page: number) => void;
  onDelete: (id: string, name: string) => void;
  onCancelApproval: (id: string, name: string) => void;
  onReviewClaim: (item: CanvasingItem) => void;
}

function renderCustomer(item: CanvasingItem) {
  return (
    <div className="flex flex-col">
      <span className="font-bold text-gray-900 dark:text-white">
        {item.nama}
      </span>
      <span className="text-xs text-gray-500">{item.paket}</span>
    </div>
  );
}

function renderSales(item: CanvasingItem) {
  return (
    <span className="text-sm">
      {item.user?.name || item.sales?.name || "-"}
    </span>
  );
}

function renderAddress(item: CanvasingItem) {
  return (
    <span className="block max-w-[200px] truncate text-sm">{item.alamat}</span>
  );
}

function renderDate(item: CanvasingItem) {
  return (
    <span className="text-xs">
      {format(new Date(item.createdAt), "dd MMM yyyy", { locale: idLocale })}
    </span>
  );
}

function renderActions({
  item,
  canUpdate,
  canReview,
  canDelete,
  onDelete,
  onCancelApproval,
  onReviewClaim,
}: {
  item: CanvasingItem;
  canUpdate: boolean;
  canReview: boolean;
  canDelete: boolean;
  onDelete: (id: string, name: string) => void;
  onCancelApproval: (id: string, name: string) => void;
  onReviewClaim: (item: CanvasingItem) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/marketing/canvasing/${item.id}`}
        className="inline-block rounded-lg bg-indigo-50 p-2 text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
        title="Lihat Detail"
        aria-label={`Lihat detail canvasing ${item.nama}`}
      >
        <HiOutlineEye className="h-5 w-5" />
      </Link>

      {item.status === "PENDING" && canUpdate && (
        <Link
          href={`/admin/marketing/canvasing/${item.id}/edit`}
          className="inline-block rounded-lg bg-amber-50 p-2 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
          title="Edit"
          aria-label={`Edit canvasing ${item.nama}`}
        >
          <HiOutlinePencilSquare className="h-5 w-5" />
        </Link>
      )}

      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(item.id, item.nama)}
          title="Hapus"
          aria-label={`Hapus canvasing ${item.nama}`}
        >
          <HiOutlineTrash className="h-5 w-5" />
        </Button>
      )}

      {item.status === "APPROVED" && canUpdate && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCancelApproval(item.id, item.nama)}
          title="Batal Approval"
          aria-label={`Batalkan approval canvasing ${item.nama}`}
        >
          <HiOutlineArrowUturnLeft className="h-5 w-5" />
        </Button>
      )}

      {getPendingClaim(item) && canReview && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReviewClaim(item)}
          title="Review Claim Poin"
          aria-label={`Review claim poin untuk ${item.nama}`}
          className="inline-flex items-center gap-1"
        >
          <HiOutlineGift className="h-5 w-5" />
          <span className="hidden sm:inline">Claim</span>
        </Button>
      )}

      {getApprovedClaim(item) && (
        <span className="flex items-center gap-1 rounded-lg bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-600">
          ⭐ Diklaim
        </span>
      )}
    </div>
  );
}

/** Render canvasing data table and row actions. */
export default function CanvasingTable({
  items,
  loading,
  page,
  totalPages,
  canUpdate,
  canReview,
  canDelete,
  onPageChange,
  onDelete,
  onCancelApproval,
  onReviewClaim,
}: CanvasingTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <ResponsiveTable<CanvasingItem>
        data={items}
        loading={loading}
        keyField="id"
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        columns={[
          {
            key: "nama",
            header: "Calon Pelanggan",
            priority: "primary",
            render: renderCustomer,
          },
          {
            key: "sales",
            header: "Sales",
            priority: "secondary",
            render: renderSales,
          },
          {
            key: "alamat",
            header: "Alamat",
            priority: "secondary",
            render: renderAddress,
          },
          {
            key: "createdAt",
            header: "Tanggal",
            priority: "secondary",
            render: renderDate,
          },
          {
            key: "status",
            header: "Status",
            priority: "primary",
            render: (item) => <StatusBadge status={item.status} />,
          },
        ]}
        emptyMessage="Tidak ada data canvasing ditemukan."
        renderActions={(item) =>
          renderActions({
            item,
            canUpdate,
            canReview,
            canDelete,
            onDelete,
            onCancelApproval,
            onReviewClaim,
          })
        }
      />
    </div>
  );
}
