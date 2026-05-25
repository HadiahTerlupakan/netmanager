import Link from "next/link";
import {
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineClipboardDocumentList,
  HiOutlineChartBar,
  HiOutlineInbox,
  HiOutlineArrowUturnLeft,
  HiOutlineShieldCheck,
} from "react-icons/hi2";
import { ensurePermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procurement - Admin Portal",
};

interface MenuCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MENU: MenuCard[] = [
  {
    href: "/admin/procurement/suppliers",
    title: "Master Supplier",
    description:
      "Kelola data supplier — status aktif, dokumen SIUP/NPWP, rekening, kontrak.",
    icon: HiOutlineUserGroup,
  },
  {
    href: "/admin/procurement/purchase-requests",
    title: "Purchase Request",
    description:
      "View PR dari sudut procurement & generate PO dari PR APPROVED.",
    icon: HiOutlineClipboardDocumentList,
  },
  {
    href: "/admin/procurement/purchase-orders",
    title: "Purchase Order",
    description: "Kelola PO ke supplier — buat, lihat, dan track pembayaran.",
    icon: HiOutlineDocumentText,
  },
  {
    href: "/admin/procurement/goods-receipts",
    title: "Goods Receipt",
    description:
      "Dokumen penerimaan barang per batch (GRN). Multi-kirim per PO.",
    icon: HiOutlineInbox,
  },
  {
    href: "/admin/procurement/goods-returns",
    title: "Retur Vendor (RTV)",
    description:
      "Retur barang rusak/salah spek/excess ke supplier dengan referensi GRN.",
    icon: HiOutlineArrowUturnLeft,
  },
  {
    href: "/admin/procurement/approval-thresholds",
    title: "Approval Threshold",
    description:
      "Atur batas nominal yang dapat di-approve oleh tiap role per scope (PR/PO).",
    icon: HiOutlineShieldCheck,
  },
  {
    href: "/admin/procurement/market-price",
    title: "Referensi Harga Pasar",
    description: "Pantau harga referensi item untuk negosiasi & forecasting.",
    icon: HiOutlineChartBar,
  },
];

export default async function ProcurementLandingPage() {
  await ensurePermission("purchase_orders:read");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Procurement
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pusat pengadaan: supplier, purchase request, purchase order, GRN, RTV,
          approval threshold, dan referensi harga.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="block p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <Icon className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
