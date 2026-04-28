"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineUserCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import InvestorBottomNav from "../components/InvestorBottomNav";
import toast from "react-hot-toast";

export default function InvestorProfile() {
  const router = useRouter();
  const [user, setUser] = useState<{
    username?: string;
    namaLengkap?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/investor/auth/session");
        const data = await res.json();

        if (res.ok && data.success && data.data?.authenticated) {
          setUser(data.data.user);
        } else {
          router.push("/investor/login");
        }
      } catch (error) {
        clientLogger.error("Session error:", error);
        router.push("/investor/login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/investor/auth/logout", {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Berhasil logout");
        router.push("/investor/login");
      }
    } catch {
      toast.error("Gagal logout");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <InvestorBottomNav />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-24 overflow-y-auto">
      {/* Header / Banner */}
      <div className="bg-gradient-to-b from-indigo-700 to-indigo-900 pb-16 pt-12 px-6 rounded-b-[40px] shadow-lg relative flex flex-col items-center">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border-[3px] border-white/40 mb-4 shadow-xl">
          <HiOutlineUserCircle className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white text-center">
          {user?.namaLengkap || "Investor"}
        </h1>
        <p className="text-indigo-200 text-sm font-medium mt-1">
          Akun Investor
        </p>
      </div>

      {/* Profile Info */}
      <div className="px-5 -mt-6 relative z-10 space-y-4">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-5 uppercase tracking-wider">
            Informasi Akun
          </h3>

          <div className="space-y-4">
            <div className="flex flex-col border-b border-gray-50 dark:border-neutral-800 pb-3">
              <span className="text-xs text-gray-500 font-medium">
                Username
              </span>
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {user?.username || "-"}
              </span>
            </div>
            <div className="flex flex-col border-b border-gray-50 dark:border-neutral-800 pb-3">
              <span className="text-xs text-gray-500 font-medium">
                Nama Lengkap
              </span>
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {user?.namaLengkap || "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium">Status</span>
              <span className="text-sm font-black text-green-500 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full w-max mt-1">
                Aktif
              </span>
            </div>
          </div>
        </div>

        {/* Additional Settings / Logout */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-2 shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-neutral-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-2xl transition-colors active:scale-95 group"
          >
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <HiOutlineArrowRightOnRectangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-left flex-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-red-600 transition-colors">
                Keluar Aplikasi
              </h4>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Akhiri sesi Anda saat ini
              </p>
            </div>
          </button>
        </div>

        <div className="flex gap-2 items-center justify-center pt-8 text-gray-400">
          <HiOutlineExclamationCircle className="w-4 h-4" />
          <span className="text-xs font-medium">
            Hubungi Admin jika ada kesalahan data
          </span>
        </div>
      </div>

      <InvestorBottomNav />
    </div>
  );
}
