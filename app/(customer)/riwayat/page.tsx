"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { Button } from "@/components/ui/Button";
import {
  MdArrowBack,
  MdSearch,
  MdReceiptLong,
  MdRouter,
  MdErrorOutline,
  MdHome,
  MdDataUsage,
  MdHistory,
  MdPerson,
} from "react-icons/md";

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string; // 'PAID' | 'SENT' | 'OVERDUE' | 'VOID'
  items: Array<{ description: string }>;
  issueDate: string;
  dueDate: string;
}

export default function CustomerHistoryPage() {
  const { isLoading: authLoading, isAuthenticated } = useCustomerAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "ALL" | "SUCCESS" | "PENDING" | "FAILED"
  >("ALL");
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/customer/invoices?limit=50");
      const json = await res.json();
      if (json.success) {
        setInvoices(json.invoices);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Logic
  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "ALL") return true;
    if (filter === "SUCCESS") return inv.status === "PAID";
    if (filter === "PENDING") return ["SENT", "OVERDUE"].includes(inv.status);
    if (filter === "FAILED") return inv.status === "VOID";
    return true;
  });

  // Group by Month
  const groupedInvoices = filteredInvoices.reduce(
    (acc, inv) => {
      const date = new Date(inv.issueDate);
      const monthYear = date.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      if (!acc[monthYear]) acc[monthYear] = [];
      acc[monthYear].push(inv);
      return acc;
    },
    {} as Record<string, Invoice[]>,
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PAID":
        return {
          label: "Lunas",
          icon: MdReceiptLong,
          iconBg: "bg-[#0d9488]/10",
          iconColor: "text-[#0d9488]",
          badgeBg: "bg-green-100 dark:bg-green-900/30",
          badgeText: "text-green-800 dark:text-green-400",
        };
      case "SENT":
      case "OVERDUE":
        return {
          label: "Menunggu",
          icon: MdRouter, // Example icon for pending
          iconBg: "bg-orange-50 dark:bg-orange-500/10",
          iconColor: "text-orange-500",
          badgeBg: "bg-yellow-100 dark:bg-yellow-900/30",
          badgeText: "text-yellow-800 dark:text-yellow-400",
        };
      default:
        return {
          label: "Gagal",
          icon: MdErrorOutline,
          iconBg: "bg-red-50 dark:bg-red-500/10",
          iconColor: "text-red-500",
          badgeBg: "bg-red-100 dark:bg-red-900/30",
          badgeText: "text-red-800 dark:text-red-400",
        };
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
        <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white overflow-x-hidden w-full min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-white dark:bg-[#1C2630] shadow-xl">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white dark:bg-[#1C2630] border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center px-4 py-3 justify-between">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => router.back()}
            >
              <MdArrowBack className="text-2xl" />
            </Button>
            <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight flex-1 text-center pr-10">
              Riwayat Transaksi
            </h2>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-2">
            <label className="flex flex-col h-12 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-[#f0f2f4] dark:bg-[#2A3441] overflow-hidden focus-within:ring-2 focus-within:ring-[#0d9488]/50 transition-all">
                <div className="text-[#617589] dark:text-gray-400 flex items-center justify-center pl-4 pr-2">
                  <MdSearch className="text-[24px]" />
                </div>
                <input
                  className="flex w-full min-w-0 flex-1 resize-none bg-transparent border-none text-[#111418] dark:text-white placeholder:text-[#617589] dark:placeholder:text-gray-500 focus:outline-0 focus:ring-0 px-2 text-base font-normal leading-normal"
                  placeholder="Cari ID Tagihan..."
                />
              </div>
            </label>
          </div>

          {/* Chips / Filters */}
          <div className="flex gap-3 px-4 py-3 overflow-x-auto hide-scrollbar pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter("ALL")}
              className={`shrink-0 rounded-full ${
                filter === "ALL"
                  ? "bg-[#0d9488] text-white shadow-sm shadow-[#0d9488]/30 hover:bg-[#0d9488]"
                  : "bg-[#f0f2f4] dark:bg-[#2A3441] text-[#111418] dark:text-gray-300"
              }`}
            >
              Semua
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter("SUCCESS")}
              className={`shrink-0 rounded-full ${
                filter === "SUCCESS"
                  ? "bg-[#0d9488] text-white shadow-sm shadow-[#0d9488]/30 hover:bg-[#0d9488]"
                  : "bg-[#f0f2f4] dark:bg-[#2A3441] text-[#111418] dark:text-gray-300"
              }`}
            >
              Berhasil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter("PENDING")}
              className={`shrink-0 rounded-full ${
                filter === "PENDING"
                  ? "bg-[#0d9488] text-white shadow-sm shadow-[#0d9488]/30 hover:bg-[#0d9488]"
                  : "bg-[#f0f2f4] dark:bg-[#2A3441] text-[#111418] dark:text-gray-300"
              }`}
            >
              Menunggu
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter("FAILED")}
              className={`shrink-0 rounded-full ${
                filter === "FAILED"
                  ? "bg-[#0d9488] text-white shadow-sm shadow-[#0d9488]/30 hover:bg-[#0d9488]"
                  : "bg-[#f0f2f4] dark:bg-[#2A3441] text-[#111418] dark:text-gray-300"
              }`}
            >
              Gagal
            </Button>
          </div>
        </header>

        {/* Main Content List */}
        <main className="flex-1 overflow-y-auto pb-24 bg-gray-50 dark:bg-[#101922]/50">
          {Object.entries(groupedInvoices).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Belum ada riwayat transaksi
            </div>
          ) : (
            Object.entries(groupedInvoices).map(([month, items]) => (
              <div key={month} className="pt-4">
                <h3 className="text-[#617589] dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-4 pb-2">
                  {month}
                </h3>
                {items.map((invoice, idx) => {
                  const config = getStatusConfig(invoice.status);
                  const Icon = config.icon;

                  return (
                    <div
                      key={invoice.id}
                      className={`bg-white dark:bg-[#1C2630] ${idx === 0 ? "border-t" : ""} border-b border-gray-100 dark:border-gray-800/50`}
                    >
                      <div className="flex gap-4 px-4 py-4 justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252e38] transition-colors">
                        <div className="flex items-start gap-4">
                          <div
                            className={`${config.iconColor} ${config.iconBg} flex items-center justify-center rounded-xl shrink-0 size-12`}
                          >
                            <Icon className="text-[24px]" />
                          </div>
                          <div className="flex flex-1 flex-col justify-center gap-0.5">
                            <p className="text-[#111418] dark:text-white text-base font-semibold leading-tight">
                              {invoice.items[0]?.description ||
                                "Tagihan Layanan"}
                            </p>
                            <p className="text-[#617589] dark:text-gray-400 text-xs font-normal leading-normal">
                              #{invoice.invoiceNumber}
                            </p>
                            <p className="text-[#617589] dark:text-gray-400 text-xs font-normal leading-normal mt-0.5">
                              {formatDate(invoice.issueDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[#111418] dark:text-white text-base font-bold leading-normal">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.badgeBg} ${config.badgeText}`}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}

          <div className="flex justify-center p-6 text-sm text-[#617589] dark:text-gray-500">
            <p>Menampilkan semua transaksi terbaru</p>
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="sticky bottom-0 z-50 bg-white dark:bg-[#1C2630] border-t border-gray-100 dark:border-gray-800 pb-safe">
          <div className="flex justify-around items-center h-16 px-2">
            <Link
              href="/dashboard"
              className="flex flex-col items-center justify-center w-full h-full gap-1 group"
            >
              <MdHome className="text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors text-[24px]" />
              <span className="text-[10px] font-medium text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors">
                Beranda
              </span>
            </Link>
            <Link
              href="/paket"
              className="flex flex-col items-center justify-center w-full h-full gap-1 group"
            >
              <MdDataUsage className="text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors text-[24px]" />
              <span className="text-[10px] font-medium text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors">
                Paket
              </span>
            </Link>
            <Link
              href="/riwayat"
              className="flex flex-col items-center justify-center w-full h-full gap-1"
            >
              <MdHistory className="text-[#0d9488] text-[24px]" />
              <span className="text-[10px] font-medium text-[#0d9488]">
                Riwayat
              </span>
            </Link>
            <Link
              href="/profil"
              className="flex flex-col items-center justify-center w-full h-full gap-1 group"
            >
              <MdPerson className="text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors text-[24px]" />
              <span className="text-[10px] font-medium text-[#617589] dark:text-gray-400 group-hover:text-[#0d9488] transition-colors">
                Akun
              </span>
            </Link>
          </div>
          <div className="h-4 w-full bg-white dark:bg-[#1C2630]"></div>
        </nav>
      </div>
    </div>
  );
}
