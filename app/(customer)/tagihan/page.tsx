"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { Button } from "@/components/ui/Button";
import {
  MdArrowBackIos,
  MdHelpOutline,
  MdCalendarToday,
  MdRouter,
  MdVerifiedUser,
  MdPendingActions,
  MdReceiptLong,
  MdCreditCard,
  MdCheckCircle,
  MdCancel,
  MdLocalOffer,
  MdContentCopy,
  MdAccessTime,
} from "react-icons/md";

interface PaymentMethod {
  id: string;
  name: string;
  provider: string;
  type: string;
  code: string;
  group: string;
  details?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

interface LastPayment {
  amount: number;
  date: string;
  method: string;
  accountId?: string;
  gatewayStatus?: string;
  expiresAt?: string;
  paymentUrl?: string;
  receiptUrl?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
  issueDate: string;
  createdAt?: string;
  items: Array<{ description: string }>;
  lastPayment?: LastPayment;
}

// Formatters
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
    year: "numeric",
  });
};

// Skeleton Component
function SkeletonPage() {
  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] max-w-md mx-auto flex flex-col items-center">
      <div className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2632] border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="w-full p-4">
        <div className="w-full h-56 bg-[#0d9488]/50 rounded-xl animate-pulse" />
      </div>
      <div className="w-full px-4 mt-2">
        <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
        <div className="flex gap-3 mb-4">
          <div className="w-20 h-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
          <div className="w-24 h-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
          <div className="w-24 h-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="w-full h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-3" />
        <div className="w-full h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("Kadaluarsa");
        onExpire();
        return false;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      );
      return true;
    };

    calculateTimeLeft();
    const interval = setInterval(() => {
      if (!calculateTimeLeft()) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return <span className="font-mono font-bold pt-0.5">{timeLeft}</span>;
}

export default function CustomerInvoicesPage() {
  const { isLoading: authLoading, isAuthenticated } = useCustomerAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PAID" | "UNPAID" | "FAILED">(
    "ALL",
  );
  const router = useRouter();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
      fetchPaymentMethods();
    }
  }, [isAuthenticated]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/customer/invoices?limit=20");
      const json = await res.json();
      if (json.success) {
        setInvoices(json.invoices);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch("/api/customer/payment-methods");
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        setPaymentMethods(json.data);
        setSelectedMethodCode(json.data[0].code); // Pre-select first
      }
    } catch (error) {
      clientLogger.error("Failed to fetch methods:", error);
    } finally {
      setLoadingMethods(false);
    }
  };

  // Identify Pending Payment
  const pendingPaymentInvoice = useMemo(() => {
    return invoices.find((inv) => inv.lastPayment?.gatewayStatus === "PENDING");
  }, [invoices]);
  const activePayment = pendingPaymentInvoice?.lastPayment;

  // Identify Selected Bank Details
  const selectedBankDetails = useMemo(() => {
    if (
      activePayment?.method === "BANK_TRANSFER" &&
      activePayment?.accountId &&
      paymentMethods.length > 0
    ) {
      const pm = paymentMethods.find(
        (p) => p.id === `manual_${activePayment.accountId}`,
      );
      return pm?.details;
    }
    return null;
  }, [activePayment, paymentMethods]);

  // Connect to SSE if there's a pending payment
  useEffect(() => {
    if (activePayment && pendingPaymentInvoice) {
      const sseUrl = `/api/customer/payments/sse?invoiceId=${pendingPaymentInvoice.id}`;
      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "PAID") {
            // Switch immediately, the SSE reported PAID
            alert("Pembayaran Berhasil Diterima!");
            fetchInvoices();
            eventSource.close();
          }
        } catch (_e) {
          // Ignore parsing errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close(); // Close on error to prevent infinite reconnection spam
      };

      return () => eventSource.close();
    }
  }, [activePayment, pendingPaymentInvoice]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${type} berhasil disalin!`);
    } catch (_e) {
      alert(`Gagal menyalin ${type}.`);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter === "ALL") return true;
      if (filter === "PAID") return inv.status === "PAID";
      if (filter === "UNPAID") return ["SENT", "OVERDUE"].includes(inv.status);
      if (filter === "FAILED") return inv.status === "VOID";
      return true;
    });
  }, [invoices, filter]);

  const pendingInvoices = useMemo(() => {
    return invoices.filter((inv) => ["SENT", "OVERDUE"].includes(inv.status));
  }, [invoices]);

  const totalPending = useMemo(() => {
    return pendingInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
  }, [pendingInvoices]);

  const nextDueDate = useMemo(() => {
    return pendingInvoices.length > 0
      ? [...pendingInvoices].sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        )[0]?.dueDate
      : null;
  }, [pendingInvoices]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "PAID":
        return {
          label: "Lunas",
          colorClass:
            "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 ring-green-600/20 dark:ring-green-400/20",
          icon: MdReceiptLong,
        };
      case "SENT":
      case "OVERDUE":
        return {
          label: "Belum Bayar",
          colorClass:
            "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 ring-orange-600/10 dark:ring-orange-400/20",
          icon: MdPendingActions,
        };
      default:
        return {
          label: status,
          colorClass:
            "text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 ring-gray-600/20",
          icon: MdReceiptLong,
        };
    }
  };

  const handleCheckCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setAppliedDiscount(null);

    try {
      const res = await fetch("/api/coupons/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          amount: totalPending,
          pelangganId: "CURRENT_USER",
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({
          code: data.code,
          amount: data.discountAmount,
        });
      } else {
        setCouponError(data.error || "Kupon tidak valid");
      }
    } catch (_error) {
      setCouponError("Gagal memverifikasi kupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!pendingInvoices.length) return;
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/customer/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: pendingInvoices.map((inv) => inv.id),
          couponCode: appliedDiscount?.code || null,
          paymentMethod: selectedMethodCode,
          notes: "Payment via Customer Portal",
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowPaymentModal(false);

        // Refresh immediately to show PENDING state
        await fetchInvoices();

        // If it's URL-based (like Duitku) and there's a payment URL, redirect
        if (
          result.data?.paymentUrl &&
          !selectedMethodCode.startsWith("MANUAL_") &&
          selectedMethodCode !== "MOOTA_MANUAL"
        ) {
          window.location.href = result.data.paymentUrl;
        }
      } else {
        alert(result.error || "Gagal membuat pembayaran");
      }
    } catch (_error) {
      alert("Terjadi kesalahan saat memproses pembayaran");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleUploadReceipt = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!pendingPaymentInvoice) return;

    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append("invoiceId", pendingPaymentInvoice.id);
      formData.append("file", file);

      const res = await fetch("/api/customer/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (res.ok && result.success) {
        alert("Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.");
        await fetchInvoices();
      } else {
        alert(result.error || "Gagal mengunggah bukti pembayaran");
      }
    } catch {
      alert("Terjadi kesalahan saat mengunggah bukti pembayaran");
    } finally {
      setUploadingReceipt(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Render skeleton if initial loading
  if (authLoading || isLoading) {
    return <SkeletonPage />;
  }

  // Render
  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white transition-colors duration-200">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-[#f6f7f8] dark:bg-[#101922]">
        {/* Top App Bar */}
        <div className="flex items-center bg-white dark:bg-[#1a2632] p-4 pb-2 justify-between sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.back()}
          >
            <MdArrowBackIos className="text-2xl" />
          </Button>
          <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Tagihan & Pembayaran
          </h2>
          <div className="flex w-12 items-center justify-end">
            <Button variant="ghost" size="icon">
              <MdHelpOutline className="text-2xl" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Pending Payment Card (Shows if a payment is in progress) */}
          {activePayment && (
            <div className="p-4 animate-in slide-in-from-top-4 duration-300">
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-500/30 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                      <h3 className="font-bold text-sm">MENUNGGU PEMBAYARAN</h3>
                    </div>
                    <p className="text-[#111418] dark:text-white text-xs opacity-80">
                      Selesaikan pembayaran sebelum waktu habis.
                    </p>
                  </div>
                  {activePayment.expiresAt && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#1a2632] text-orange-600 dark:text-orange-400 rounded border border-orange-200 dark:border-orange-500/20 shadow-sm text-sm">
                      <MdAccessTime />
                      <CountdownTimer
                        expiresAt={activePayment.expiresAt}
                        onExpire={fetchInvoices}
                      />
                    </div>
                  )}
                </div>

                {/* Custom Moota / Transfer UI */}
                {activePayment.method === "BANK_TRANSFER" &&
                selectedBankDetails ? (
                  <div className="bg-white dark:bg-[#1a2632] rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                      Transfer Bank Manual ({selectedBankDetails.bankName}):
                    </p>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-bold text-[#111418] dark:text-white text-lg">
                          {selectedBankDetails.accountNumber}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          a.n {selectedBankDetails.accountName}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            selectedBankDetails.accountNumber,
                            "Nomor Rekening",
                          )
                        }
                      >
                        <MdContentCopy /> Salin
                      </Button>
                    </div>
                    <div className="border-t border-dashed border-gray-200 dark:border-gray-700 py-2"></div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 mt-1 font-medium">
                      Nominal Transfer:
                    </p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[#0d9488] text-xl">
                          {formatCurrency(activePayment.amount)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            activePayment.amount.toString(),
                            "Nominal",
                          )
                        }
                      >
                        <MdContentCopy /> Salin
                      </Button>
                    </div>

                    {activePayment.receiptUrl ? (
                      <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg flex flex-col items-center">
                        <MdCheckCircle className="text-teal-600 dark:text-teal-400 text-3xl mb-2" />
                        <p className="font-bold text-teal-800 dark:text-teal-300 text-sm">
                          Menunggu Verifikasi Admin
                        </p>
                        <p className="text-teal-600 dark:text-teal-400 text-xs text-center mt-1">
                          Bukti transfer Anda sedang direview. Proses ini dapat
                          memakan waktu beberapa saat pada jam kerja.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col items-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                          Silakan unggah bukti transfer setelah melakukan
                          pembayaran.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleUploadReceipt}
                        />
                        <Button
                          variant="success"
                          className="w-full"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingReceipt}
                        >
                          {uploadingReceipt
                            ? "Mengunggah..."
                            : "Unggah Bukti Transfer"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#1a2632] rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm mb-4">
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      Total Pembayaran
                    </p>
                    <p className="font-bold text-center text-[#0d9488] text-2xl">
                      {formatCurrency(activePayment.amount)}
                    </p>
                    {activePayment.paymentUrl && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => {
                          window.location.href = activePayment.paymentUrl!;
                        }}
                      >
                        Lanjutkan ke Halaman Pembayaran
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hero Card: Current Bill (Hide if pending) */}
          {!activePayment && (
            <div className="p-4">
              <div className="relative overflow-hidden rounded-xl bg-[#0d9488] shadow-lg dark:shadow-teal-900/20">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-HU9cqe6mcWGdTC97GiGE9Cpcz8BtknnjXpnAibr__w5Mp18897Z_ETiwCLP8684O2A6OaPPZG2gbjE9V33mJP_kcjPCud4uMkUHdMLUcO0x3njsMz_j2y4XLD044QbwKs0F7O2ZI-06Kw3uPuoYqeR5Qkk6AUXB9CMWFWY9iFrqApW30mSi65fUu9lXbRZD8FNxiSd05IMYrDtabjomcqLhA659gZookpcmJCXKGjJ4FtmYOthORCnxg8wXQzQZKZB3jyc1iark")',
                  }}
                ></div>
                <div className="relative z-10 flex flex-col p-6 h-full justify-between min-h-[220px]">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <p className="text-white/90 text-sm font-medium">
                        Total Tagihan Bulan Ini
                      </p>
                      <h1 className="text-white text-3xl font-bold tracking-tight">
                        {formatCurrency(totalPending)}
                      </h1>
                      {nextDueDate ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MdCalendarToday className="text-white/80 text-sm" />
                          <p className="text-white/80 text-xs font-medium">
                            Jatuh tempo {formatDate(nextDueDate)}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MdCheckCircle className="text-white/80 text-sm" />
                          <p className="text-white/80 text-xs font-medium">
                            Tidak ada tagihan tertunggak
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                      <MdRouter className="text-white" />
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-white/80 text-xs">
                      <MdVerifiedUser className="text-[16px]" />
                      <span>Pembayaran aman & terenkripsi</span>
                    </div>
                    {totalPending > 0 && (
                      <Button
                        onClick={() => setShowPaymentModal(true)}
                        variant="outline"
                        className="w-full h-12"
                      >
                        <span>Bayar Sekarang</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Headline: Transaction History */}
          <div className="px-4 pt-4 pb-2 flex justify-between items-end">
            <h3 className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight">
              Riwayat Transaksi
            </h3>
            <Button variant="link" className="text-[#0d9488]">
              Unduh Semua
            </Button>
          </div>

          {/* Filter Chips */}
          <div className="w-full overflow-x-auto hide-scrollbar pb-2">
            <div className="flex gap-3 px-4 min-w-max">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter("ALL")}
                className={`rounded-full ${
                  filter === "ALL"
                    ? "bg-[#111418] dark:bg-white text-white dark:text-[#111418] hover:bg-[#111418] dark:hover:bg-white"
                    : "bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700"
                }`}
              >
                Semua
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter("PAID")}
                className={`rounded-full ${
                  filter === "PAID"
                    ? "bg-[#111418] dark:bg-white text-white dark:text-[#111418] hover:bg-[#111418] dark:hover:bg-white"
                    : "bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700"
                }`}
              >
                Lunas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter("UNPAID")}
                className={`rounded-full ${
                  filter === "UNPAID"
                    ? "bg-[#111418] dark:bg-white text-white dark:text-[#111418] hover:bg-[#111418] dark:hover:bg-white"
                    : "bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700"
                }`}
              >
                Belum Bayar
              </Button>
            </div>
          </div>

          {/* List of Transactions */}
          <div className="flex flex-col mt-2">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>Tidak ada riwayat transaksi</p>
              </div>
            ) : (
              filteredInvoices.map((invoice) => {
                const statusInfo = getStatusInfo(invoice.status);
                const Icon = statusInfo.icon;
                const dateObj = new Date(
                  invoice.issueDate || invoice.createdAt || new Date(),
                );
                const monthYear = dateObj.toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                });

                return (
                  <div
                    key={invoice.id}
                    className="group cursor-pointer active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 bg-white dark:bg-[#1a2632] px-4 py-4 justify-between border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex items-center justify-center rounded-full shrink-0 size-12 ${
                            invoice.status === "PAID"
                              ? "bg-[#f6f7f8] dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          <Icon className="text-2xl" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[#111418] dark:text-white text-base font-semibold leading-tight capitalize">
                            {monthYear}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium line-clamp-1">
                            {invoice.invoiceNumber} •{" "}
                            {invoice.items[0]?.description ||
                              "Layanan Internet"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-[#111418] dark:text-white font-bold text-base">
                          {formatCurrency(invoice.totalAmount)}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusInfo.colorClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a2632] w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Rincian Pembayaran</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPaymentModal(false)}
              >
                <MdCancel className="text-2xl text-gray-500" />
              </Button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto hide-scrollbar pb-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Total Tagihan ({pendingInvoices.length} item)
                </span>
                <span className="font-semibold">
                  {formatCurrency(totalPending)}
                </span>
              </div>

              {/* Coupon Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MdLocalOffer className="text-[#0d9488]" />
                  Kode Kupon
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 uppercase"
                    placeholder="Masukan kode"
                    value={couponCode}
                    onChange={(e) =>
                      setCouponCode(e.target.value.toUpperCase())
                    }
                    disabled={appliedDiscount !== null}
                  />
                  {appliedDiscount ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setAppliedDiscount(null);
                        setCouponCode("");
                      }}
                    >
                      Hapus
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleCheckCoupon}
                      disabled={couponLoading || !couponCode}
                      loading={couponLoading}
                    >
                      Gunakan
                    </Button>
                  )}
                </div>
                {couponError && (
                  <p className="text-xs text-red-500">{couponError}</p>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
                    <span>Diskon ({appliedDiscount.code})</span>
                    <span className="font-bold">
                      -{formatCurrency(appliedDiscount.amount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-4"></div>

              {/* Payment Method Pre-Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MdCreditCard className="text-[#0d9488]" />
                  Metode Pembayaran
                </label>
                {loadingMethods ? (
                  <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ) : paymentMethods.length === 0 ? (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    Tidak ada metode pembayaran tersedia
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {/* Grouping methods logic could go here, but a flat list is also okay for now. */}
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedMethodCode(method.code)}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedMethodCode === method.code
                            ? "border-[#0d9488] bg-[#0d9488]/5 dark:bg-[#0d9488]/10"
                            : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">
                            {method.name}
                          </span>
                          <span className="text-[10px] text-gray-500 uppercase">
                            {method.group}
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedMethodCode === method.code
                              ? "border-[#0d9488]"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedMethodCode === method.code && (
                            <div className="w-2 h-2 rounded-full bg-[#0d9488]" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-4"></div>

              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Bayar</span>
                <span className="text-[#0d9488]">
                  {formatCurrency(
                    totalPending - (appliedDiscount?.amount || 0),
                  )}
                </span>
              </div>

              <Button
                onClick={handlePayment}
                disabled={paymentLoading || !selectedMethodCode}
                loading={paymentLoading}
                className="w-full h-12 mt-2"
              >
                Konfirmasi & Bayar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
