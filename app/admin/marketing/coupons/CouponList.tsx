"use client";

import { clientLogger } from "@/lib/client-logger";
import Link from "next/link";
import { HiOutlinePlus, HiTrash } from "react-icons/hi2";
import { Button, buttonVariants } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";
import PageLoader from "@/components/ui/PageLoader";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";

interface Coupon {
  id: string;
  code: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  startDate: string;
  endDate: string;
  quota: number;
  usedCount: number;
  isActive: boolean;
  _count: { usages: number };
}

interface CouponListResponse {
  data?: Coupon[];
}

export default function CouponList() {
  const { data, error, isLoading, mutate } = useApi<
    Coupon[] | CouponListResponse
  >("/api/coupons");

  if (error) {
    toast.error(error.message || "Gagal memuat data kupon");
  }

  const coupons: Coupon[] = Array.isArray(data) ? data : (data?.data ?? []);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah anda yakin ingin menghapus kupon ini?")) return;
    try {
      const res = await fetch(`/api/coupons/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Kupon berhasil dihapus");
        await mutate();
      } else {
        const json = await res.json();
        toast.error(json.error || "Gagal menghapus kupon");
      }
    } catch (err) {
      clientLogger.error("Delete failed", err);
      toast.error("Terjadi kesalahan saat menghapus kupon");
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Manajemen Kupon
        </h1>
        <Link
          href="/admin/marketing/coupons/create"
          className={`${buttonVariants({ variant: "default", size: "default" })} !text-white`}
        >
          <HiOutlinePlus className="w-5 h-5" />
          Buat Kupon
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <ResponsiveTable<Coupon>
          data={coupons}
          loading={isLoading}
          keyField="id"
          columns={[
            {
              key: "code",
              header: "Kode",
              priority: "primary",
              render: (item) => (
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.code}
                </span>
              ),
            },
            {
              key: "discountValue",
              header: "Diskon",
              priority: "primary",
              render: (item) => (
                <span>
                  {item.discountType === "FIXED"
                    ? `Rp ${item.discountValue.toLocaleString("id-ID")}`
                    : `${item.discountValue}%`}
                </span>
              ),
            },
            {
              key: "berlaku",
              header: "Berlaku",
              priority: "secondary",
              render: (item) => (
                <div className="text-xs space-y-1">
                  <div>
                    Mulai: {new Date(item.startDate).toLocaleDateString()}
                  </div>
                  <div>
                    Selesai: {new Date(item.endDate).toLocaleDateString()}
                  </div>
                </div>
              ),
            },
            {
              key: "quota",
              header: "Penggunaan / Kuota",
              priority: "secondary",
              render: (item) => (
                <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 max-w-[100px]">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{
                        width: `${Math.min((item.usedCount / (item.quota || 1)) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs">
                    {item.usedCount} / {item.quota === 0 ? "ထ" : item.quota}
                  </span>
                </div>
              ),
            },
            {
              key: "isActive",
              header: "Status",
              priority: "primary",
              render: (item) => (
                <StatusBadge status={item.isActive ? "AKTIF" : "NONAKTIF"} />
              ),
            },
          ]}
          emptyMessage="Tidak ada kupon ditemukan. Buat satu untuk memulai."
          renderActions={(item) => (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(item.id)}
            >
              <HiTrash className="w-5 h-5" />
            </Button>
          )}
        />
      </div>
    </div>
  );
}
