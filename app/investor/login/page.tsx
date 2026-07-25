"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineUser,
  HiOutlineLockClosed,
  HiArrowRight,
} from "react-icons/hi2";
import toast from "react-hot-toast";

export default function InvestorLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/investor/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login gagal");
      }

      toast.success("Login berhasil");
      router.push("/investor");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login gagal");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-black min-h-screen w-full">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-2">
            <span className="text-2xl font-black text-white">i</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Investor Portal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Masuk untuk melihat performa investasi Anda
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-neutral-800/50 p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-neutral-800 space-y-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <HiOutlineUser className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-neutral-900 border-transparent rounded-2xl text-sm focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900 dark:text-white"
                  placeholder="Masukkan username Anda"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <HiOutlineLockClosed className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-neutral-900 border-transparent rounded-2xl text-sm focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Masuk ke Portal
                <HiArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 pt-4">
          Jika Anda mengalami kendala saat login,
          <br />
          silahkan hubungi administrator.
        </p>
      </div>
    </div>
  );
}
