"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi2";
import { toast } from "react-hot-toast";

export default function CouponForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "FIXED", // 'FIXED', 'PERCENT'
    discountValue: "",
    startDate: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
      .toISOString()
      .split("T")[0],
    minTransaction: "",
    maxDiscount: "",
    quota: "",
    isActive: true,
  });

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal membuat kupon");
      }

      router.push("/admin/marketing/coupons");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat membuat kupon";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/marketing/coupons"
          className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700 transition-colors"
        >
          <HiArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Buat Kupon Baru</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Code & Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Kode Kupon
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 uppercase font-mono tracking-wider"
                placeholder="PROMO2024"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Deskripsi
              </label>
              <textarea
                className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                rows={2}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Discount Logic */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipe Diskon
                </label>
                <select
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  value={formData.discountType}
                  onChange={(e) =>
                    setFormData({ ...formData, discountType: e.target.value })
                  }
                >
                  <option value="FIXED">Nominal Tetap (Rp)</option>
                  <option value="PERCENT">Persentase (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nilai Diskon
                </label>
                <input
                  type="number"
                  required
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  placeholder={
                    formData.discountType === "FIXED" ? "10000" : "10"
                  }
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Constraints */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Min. Transaksi (Rp)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  placeholder="0"
                  value={formData.minTransaction}
                  onChange={(e) =>
                    setFormData({ ...formData, minTransaction: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Max. Diskon (Rp)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Optional for % type"
                  value={formData.maxDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, maxDiscount: e.target.value })
                  }
                  disabled={formData.discountType === "FIXED"}
                />
              </div>
            </div>

            {/* Validity & Quota */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tanggal Berakhir
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Kuota (0 = Tak Terbatas)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                  placeholder="0"
                  value={formData.quota}
                  onChange={(e) =>
                    setFormData({ ...formData, quota: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Langsung Aktifkan
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Buat Kupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
