"use client";

import {
  OUTSTANDING_INVOICE_STATUSES,
  isOutstandingInvoiceStatus,
} from "@/lib/constants/invoice-status";
import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CustomerNotificationBell } from "@/components/customer/CustomerNotificationBell";
import { GatewayPendingCard } from "./GatewayPayInstructions";
import { PaymentSuccessSheet } from "./PaymentSuccessSheet";
import { UnpaidInvoiceList } from "./UnpaidInvoiceList";
import {
  useTagihanLiveUpdates,
  type PaidSummary,
} from "./usePaymentLiveStatus";
import { useApi } from "@/lib/hooks/useApi";
import { useInfiniteApi } from "@/lib/hooks/useInfiniteApi";
import { InfiniteScrollSentinel } from "@/components/ui/InfiniteScrollSentinel";
import {
  MdArrowBackIos,
  MdCalendarToday,
  MdRouter,
  MdVerifiedUser,
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
  id?: string;
  amount: number;
  date: string;
  method: string;
  accountId?: string;
  gatewayStatus?: string;
  expiresAt?: string;
  paymentUrl?: string;
  vaNumber?: string | null;
  qrString?: string | null;
  gatewayProvider?: string | null;
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
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>("");
  const router = useRouter();

  const {
    items: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
    fetchNextPage: fetchNextInvoices,
    hasNextPage: hasNextInvoices,
    isFetchingNextPage: isFetchingNextInvoices,
  } = useInfiniteApi<Invoice>(
    // Hanya tagihan terbuka: halaman ini tidak memuat riwayat, dan tanpa
    // filter server tagihan lama yang belum dibayar bisa tertinggal di
    // halaman berikutnya sehingga tidak ikut terhitung di total.
    isAuthenticated
      ? `/api/customer/invoices?status=${OUTSTANDING_INVOICE_STATUSES.join(",")}`
      : null,
    {
      limit: 20,
      mapResponse: (raw) => {
        const obj = raw as {
          invoices?: Invoice[];
          pagination?: { page: number; limit: number; total: number };
        };
        return {
          data: obj.invoices ?? [],
          page: obj.pagination?.page ?? 1,
          limit: obj.pagination?.limit ?? 20,
          total: obj.pagination?.total ?? 0,
        };
      },
    },
  );
  const mutateInvoices = refetchInvoices;
  const {
    data: paymentMethodsData,
    error: paymentMethodsError,
    isLoading: paymentMethodsLoading,
  } = useApi<PaymentMethod[]>(
    isAuthenticated ? "/api/customer/payment-methods" : null,
  );

  useEffect(() => {
    if (invoicesError) {
      clientLogger.error("Failed to fetch invoices:", invoicesError);
    }
  }, [invoicesError]);
  useEffect(() => {
    if (paymentMethodsError) {
      clientLogger.error("Failed to fetch methods:", paymentMethodsError);
    }
  }, [paymentMethodsError]);

  const paymentMethods: PaymentMethod[] = useMemo(
    () => (Array.isArray(paymentMethodsData) ? paymentMethodsData : []),
    [paymentMethodsData],
  );
  const isLoading = invoicesLoading;
  const loadingMethods = paymentMethodsLoading;

  // Pre-select first payment method (derived, not effect-driven)
  const effectiveMethodCode =
    selectedMethodCode || paymentMethods[0]?.code || "";

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
  const [paidSummary, setPaidSummary] = useState<PaidSummary | null>(null);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

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

  // Portal menyimpan kode channel (mis. "BC") di gatewayProvider.
  const activeGatewayMethod = useMemo(
    () =>
      paymentMethods.find(
        (method) => method.code === activePayment?.gatewayProvider,
      ),
    [activePayment, paymentMethods],
  );

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("success", `${type} berhasil disalin`);
    } catch (_e) {
      showToast("error", `Gagal menyalin ${type}`);
    }
  };

  // Termasuk PARTIAL_PAID: sisa tagihannya masih harus dibayar, dan ringkasan
  // dashboard sudah menghitungnya — kalau di sini dikecualikan, dua halaman
  // menampilkan angka tunggakan yang berbeda.
  const pendingInvoices = useMemo(() => {
    return invoices.filter((inv) => isOutstandingInvoiceStatus(inv.status));
  }, [invoices]);

  useTagihanLiveUpdates({
    watchedInvoice: pendingPaymentInvoice ?? pendingInvoices[0],
    hasActivePayment: Boolean(activePayment),
    methodName: activeGatewayMethod?.name,
    refetch: mutateInvoices,
    onPaid: setPaidSummary,
  });

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

  const handleCheckCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setAppliedDiscount(null);

    try {
      // `/api/coupons/verify` khusus staf (NextAuth) dan selalu 401 untuk
      // pelanggan; endpoint pelanggan mengambil id pelanggan dari sesi.
      const res = await fetch("/api/customer/coupons/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, amount: totalPending }),
      });
      const data = await res.json();
      if (data.success && data.data?.valid) {
        setAppliedDiscount({
          code: data.data.code,
          amount: data.data.discountAmount,
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
          couponCode: appliedDiscount?.code,
          paymentMethod: effectiveMethodCode,
          notes: "Payment via Customer Portal",
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowPaymentModal(false);

        // Refresh immediately to show PENDING state
        await mutateInvoices();

        // Nomor VA / QRIS ditampilkan di kartu menunggu pembayaran; hanya
        // metode tanpa instruksi (kartu kredit, e-wallet login) dialihkan.
        if (
          result.data?.paymentUrl &&
          !result.data?.vaNumber &&
          !result.data?.qrString &&
          !effectiveMethodCode.startsWith("MANUAL_") &&
          effectiveMethodCode !== "MOOTA_MANUAL"
        ) {
          window.location.href = result.data.paymentUrl;
        }
      } else {
        showToast("error", result.error || "Gagal membuat pembayaran");
      }
    } catch (_error) {
      showToast("error", "Terjadi kesalahan saat memproses pembayaran");
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
        showToast(
          "success",
          "Bukti pembayaran terkirim. Menunggu verifikasi admin.",
        );
        await mutateInvoices();
      } else {
        showToast("error", result.error || "Gagal mengunggah bukti pembayaran");
      }
    } catch {
      showToast("error", "Terjadi kesalahan saat mengunggah bukti pembayaran");
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
            <CustomerNotificationBell />
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
                        onExpire={() => {
                          mutateInvoices();
                        }}
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
                  <GatewayPendingCard
                    amount={formatCurrency(activePayment.amount)}
                    vaNumber={activePayment.vaNumber}
                    qrString={activePayment.qrString}
                    paymentUrl={activePayment.paymentUrl}
                    methodName={activeGatewayMethod?.name}
                    methodType={activeGatewayMethod?.type}
                    onCopy={copyToClipboard}
                    onChangeMethod={() => setShowPaymentModal(true)}
                  />
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

          <UnpaidInvoiceList invoices={pendingInvoices} />
          <InfiniteScrollSentinel
            onLoadMore={fetchNextInvoices}
            hasNextPage={hasNextInvoices}
            isFetchingNextPage={isFetchingNextInvoices}
          />
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
              {/* Duitku tidak bisa menutup VA lebih awal; kelebihan bayar
                  dikreditkan ke saldo oleh webhook. */}
              {activePayment && (
                <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Nomor VA/QRIS sebelumnya akan diganti. Bayar hanya yang baru;
                  bila terlanjur membayar keduanya, kelebihannya menjadi saldo
                  yang memotong tagihan berikutnya.
                </p>
              )}
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
                          effectiveMethodCode === method.code
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
                            effectiveMethodCode === method.code
                              ? "border-[#0d9488]"
                              : "border-gray-300"
                          }`}
                        >
                          {effectiveMethodCode === method.code && (
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
                disabled={paymentLoading || !effectiveMethodCode}
                loading={paymentLoading}
                className="w-full h-12 mt-2"
              >
                Konfirmasi & Bayar
              </Button>
            </div>
          </div>
        </div>
      )}

      {paidSummary && (
        <PaymentSuccessSheet
          amount={formatCurrency(paidSummary.amount)}
          invoiceNumber={paidSummary.invoiceNumber}
          methodName={paidSummary.methodName}
          onClose={() => setPaidSummary(null)}
          onHome={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
