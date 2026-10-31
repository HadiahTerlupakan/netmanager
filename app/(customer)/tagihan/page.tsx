"use client";

import { OUTSTANDING_INVOICE_STATUSES } from "@/lib/constants/invoice-status";
import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MdArrowBackIos } from "react-icons/md";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { CustomerNotificationBell } from "@/components/customer/CustomerNotificationBell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { InfiniteScrollSentinel } from "@/components/ui/InfiniteScrollSentinel";
import { useApi } from "@/lib/hooks/useApi";
import { useInfiniteApi } from "@/lib/hooks/useInfiniteApi";
import { formatCurrency } from "@/lib/utils";
import { BillSummaryCard } from "./BillSummaryCard";
import {
  CheckPaymentStatusButton,
  type CheckedPaymentStatus,
} from "./CheckPaymentStatusButton";
import { GatewayPendingCard } from "./GatewayPayInstructions";
import { ManualTransferCard, resolveBankAccount } from "./ManualTransferCard";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import { PaymentSuccessSheet } from "./PaymentSuccessSheet";
import { PendingPaymentCard } from "./PendingPaymentCard";
import { RejectedTransferNotice } from "./RejectedTransferNotice";
import { UnpaidInvoiceList } from "./UnpaidInvoiceList";
import { TagihanSkeleton } from "./TagihanSkeleton";
import {
  findCheckoutMethod,
  getCheckoutInvoiceNumbers,
  getCheckoutTotal,
  isManualTransfer,
  summarizeInvoices,
  type Invoice,
} from "./checkout";
import { useCouponDiscount } from "./useCouponDiscount";
import { usePaymentMethods } from "./usePaymentMethods";
import { usePaymentSubmission } from "./usePaymentSubmission";
import {
  useTagihanLiveUpdates,
  type PaidSummary,
  type ShownCheckout,
} from "./useTagihanLiveUpdates";

const INVOICE_PAGE_SIZE = 20;
// Hanya tagihan terbuka: halaman ini tidak memuat riwayat, dan tanpa filter
// server tagihan lama yang belum dibayar bisa tertinggal di halaman
// berikutnya sehingga tidak ikut terhitung di total.
const OUTSTANDING_INVOICES_URL = `/api/customer/invoices?status=${OUTSTANDING_INVOICE_STATUSES.join(",")}`;

function mapInvoicePage(raw: unknown) {
  const page = raw as {
    invoices?: Invoice[];
    pagination?: { page: number; limit: number; total: number };
  };
  return {
    data: page.invoices ?? [],
    page: page.pagination?.page ?? 1,
    limit: page.pagination?.limit ?? INVOICE_PAGE_SIZE,
    total: page.pagination?.total ?? 0,
  };
}

export default function CustomerInvoicesPage() {
  const { isLoading: authLoading, isAuthenticated } = useCustomerAuth();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const {
    items: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
    fetchNextPage: fetchNextInvoices,
    hasNextPage: hasNextInvoices,
    isFetchingNextPage: isFetchingNextInvoices,
  } = useInfiniteApi<Invoice>(
    isAuthenticated ? OUTSTANDING_INVOICES_URL : null,
    { limit: INVOICE_PAGE_SIZE, mapResponse: mapInvoicePage },
  );
  useEffect(() => {
    if (invoicesError) {
      clientLogger.error("Failed to fetch invoices:", invoicesError);
    }
  }, [invoicesError]);

  const bill = useMemo(() => summarizeInvoices(invoices), [invoices]);
  const coupon = useCouponDiscount(bill.totalPending);
  const methods = usePaymentMethods(
    isAuthenticated && !invoicesLoading,
    Math.max(bill.totalPending - (coupon.applied?.amount ?? 0), 0),
  );
  useEffect(() => {
    if (methods.error) {
      clientLogger.error("Failed to fetch methods:", methods.error);
    }
  }, [methods.error]);
  const { data: profileData } = useApi<{ profile?: { saldoKredit?: number } }>(
    isAuthenticated ? "/api/customer/profile" : null,
  );

  const [isMethodDialogOpen, setIsMethodDialogOpen] = useState(false);
  const submission = usePaymentSubmission({
    payableInvoices: bill.payable,
    couponCode: coupon.applied?.code,
    refetch: refetchInvoices,
    onCreated: () => setIsMethodDialogOpen(false),
  });
  const [paidSummary, setPaidSummary] = useState<PaidSummary | null>(null);
  const [expiredCheckoutKey, setExpiredCheckoutKey] = useState<string | null>(
    null,
  );

  const pendingInvoice = bill.pendingPaymentInvoice;
  const activePayment = pendingInvoice?.lastPayment ?? undefined;
  const isManual = activePayment ? isManualTransfer(activePayment) : false;
  const checkoutKey =
    pendingInvoice && activePayment
      ? `${pendingInvoice.id}:${activePayment.id ?? ""}:${activePayment.expiresAt ?? ""}`
      : null;
  const isCheckoutExpired =
    checkoutKey !== null && checkoutKey === expiredCheckoutKey;
  const checkoutMethod = activePayment
    ? findCheckoutMethod(methods.list, activePayment)
    : undefined;
  const checkoutMethodName =
    checkoutMethod && isManual
      ? `Transfer ${checkoutMethod.name}`
      : checkoutMethod?.name;

  const shownCheckout: ShownCheckout | undefined =
    pendingInvoice && activePayment && !isCheckoutExpired
      ? {
          invoiceId: pendingInvoice.id,
          summary: {
            amount: getCheckoutTotal(activePayment),
            invoiceNumber: getCheckoutInvoiceNumbers(
              activePayment,
              pendingInvoice.invoiceNumber,
            ).join(", "),
            methodName: checkoutMethodName,
          },
        }
      : undefined;

  const { announcePaid } = useTagihanLiveUpdates({
    // Tagihan yang ditutup saldo tidak dipantau: pelunasannya oleh saldo
    // bukan pembayaran yang perlu dirayakan.
    watchedInvoice: pendingInvoice ?? bill.payable[0],
    shownCheckout,
    outstandingInvoiceIds: bill.outstanding.map((inv) => inv.id),
    refetch: refetchInvoices,
    onPaid: (summary) => {
      setIsMethodDialogOpen(false);
      setPaidSummary(summary);
    },
  });

  const openMethodDialog = () => {
    submission.clearError();
    setIsMethodDialogOpen(true);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("success", `${label} berhasil disalin`);
    } catch {
      showToast("error", `Gagal menyalin ${label}`);
    }
  };

  // Sekali per checkout (lihat useExpiryCountdown): kartu berganti ke
  // keadaan kedaluwarsa dan daftar dimuat ulang satu kali.
  const handleCheckoutExpired = () => {
    setExpiredCheckoutKey(checkoutKey);
    void refetchInvoices();
  };

  const handleStatusChecked = (status: CheckedPaymentStatus) => {
    if (status === "PENDING") return;
    if (status === "PAID" && pendingInvoice) announcePaid(pendingInvoice.id);
    void refetchInvoices();
  };

  if (authLoading || invoicesLoading) {
    return <TagihanSkeleton />;
  }

  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white transition-colors duration-200">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-[#f6f7f8] dark:bg-[#101922]">
        <div className="flex items-center bg-white dark:bg-[#1a2632] p-4 pb-2 justify-between sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Kembali"
            onClick={() => router.back()}
          >
            <MdArrowBackIos className="text-2xl" aria-hidden="true" />
          </Button>
          <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Tagihan & Pembayaran
          </h2>
          <div className="flex w-12 items-center justify-end">
            <CustomerNotificationBell />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {pendingInvoice && activePayment ? (
            <PendingPaymentCard
              key={checkoutKey}
              isManual={isManual}
              expiresAt={activePayment.expiresAt}
              isExpired={isCheckoutExpired}
              invoiceNumbers={getCheckoutInvoiceNumbers(
                activePayment,
                pendingInvoice.invoiceNumber,
              )}
              onExpire={handleCheckoutExpired}
              onChooseMethod={openMethodDialog}
            >
              {isManual ? (
                <ManualTransferCard
                  invoiceId={pendingInvoice.id}
                  amount={getCheckoutTotal(activePayment)}
                  hasReceipt={Boolean(activePayment.receiptUrl)}
                  bank={resolveBankAccount(methods, checkoutMethod)}
                  onCopy={copyToClipboard}
                  refresh={refetchInvoices}
                  onCancelled={openMethodDialog}
                />
              ) : (
                <GatewayPendingCard
                  amount={formatCurrency(getCheckoutTotal(activePayment))}
                  vaNumber={activePayment.vaNumber}
                  qrString={activePayment.qrString}
                  paymentUrl={activePayment.paymentUrl}
                  methodName={checkoutMethod?.name}
                  methodType={checkoutMethod?.type}
                  onCopy={copyToClipboard}
                  onChangeMethod={openMethodDialog}
                >
                  <CheckPaymentStatusButton
                    invoiceId={pendingInvoice.id}
                    onChecked={handleStatusChecked}
                  />
                </GatewayPendingCard>
              )}
            </PendingPaymentCard>
          ) : (
            <>
              {bill.rejectedTransfer && (
                <RejectedTransferNotice
                  reason={bill.rejectedTransfer.rejectionReason}
                />
              )}
              <BillSummaryCard
                totalPending={bill.totalPending}
                nextDueDate={bill.nextDueDate}
                saldoKredit={profileData?.profile?.saldoKredit}
                onPay={openMethodDialog}
              />
            </>
          )}

          <UnpaidInvoiceList invoices={bill.outstanding} />
          {/* Server hanya mengirim tagihan terbuka, jadi daftar kosong berarti
              tidak ada halaman berikutnya; penanda "akhir daftar" di bawah
              keadaan kosong hanya membingungkan. */}
          {bill.outstanding.length > 0 && (
            <InfiniteScrollSentinel
              onLoadMore={fetchNextInvoices}
              hasNextPage={hasNextInvoices}
              isFetchingNextPage={isFetchingNextInvoices}
            />
          )}
        </div>
      </div>

      {isMethodDialogOpen && (
        <PaymentMethodDialog
          itemCount={bill.payable.length}
          totalPending={bill.totalPending}
          isReplacingCheckout={
            Boolean(activePayment) && !isManual && !isCheckoutExpired
          }
          coupon={coupon}
          methods={methods}
          selectedCode={submission.selectedMethodCode}
          onSelectMethod={submission.selectMethod}
          isSubmitting={submission.isSubmitting}
          submitError={submission.submitError}
          onConfirm={submission.submit}
          onClose={() => setIsMethodDialogOpen(false)}
        />
      )}

      {paidSummary && (
        <PaymentSuccessSheet
          amount={formatCurrency(paidSummary.amount)}
          invoiceNumber={paidSummary.invoiceNumber}
          methodName={paidSummary.methodName}
          onClose={() => setPaidSummary(null)}
          onHistory={() => router.push("/riwayat")}
          onHome={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
