"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  MdArrowForward,
  MdBolt,
  MdCheckCircle,
  MdDescription,
  MdHistory,
  MdReceiptLong,
  MdRocketLaunch,
  MdRouter,
  MdSupportAgent,
} from "react-icons/md";
import { Button } from "@/components/ui/Button";
import {
  DashboardHttpError,
  fetchDashboardResource,
} from "@/lib/dashboard/fetchDashboardResource";
import { z } from "zod";
import { CustomerNotificationBell } from "@/components/customer/CustomerNotificationBell";

const dashboardSummarySchema = z.object({
  profile: z.object({
    state: z.enum(["ready", "error"]),
    data: z
      .object({
        nama: z.string(),
        paket: z
          .object({
            nama: z.string(),
            bandwidth: z
              .object({
                download: z.string().or(z.number()),
                upload: z.string().or(z.number()).optional(),
              })
              .nullable(),
          })
          .nullable(),
      })
      .nullable(),
    message: z.string().optional(),
  }),
  connection: z.object({
    state: z.enum(["ready", "error"]),
    data: z
      .object({
        isOnline: z.boolean(),
        ipAddress: z.string().nullable(),
      })
      .nullable(),
    message: z.string().optional(),
  }),
  billing: z.object({
    state: z.enum(["ready", "error"]),
    data: z
      .object({
        outstandingCount: z.number(),
        outstandingAmount: z.number(),
        nearestDueDate: z.string().nullable(),
        hasOverdue: z.boolean(),
      })
      .nullable(),
    message: z.string().optional(),
  }),
});

type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

interface CustomerDashboardClientProps {
  customerId: string;
  customerName: string;
}

interface CustomerDashboardContentProps extends CustomerDashboardClientProps {
  summary: DashboardSummary | null;
  isLoading: boolean;
  dashboardError: Error | null;
}

type DashboardFailureState = {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

const INITIAL_LOAD_LABEL = "Memuat dashboard pelanggan";
const BILLING_ERROR_LABEL = "Tagihan belum bisa diverifikasi";
const CONNECTION_ERROR_LABEL = "Status perangkat belum tersedia";
const DEFAULT_DASHBOARD_ERROR_MESSAGE =
  "Kami belum bisa membaca ringkasan dashboard saat ini.";
const AUTHENTICATION_ERROR_MESSAGE =
  "Sesi Anda sudah berakhir. Silakan login kembali untuk membuka dashboard pelanggan.";
const RETRY_DASHBOARD_LABEL = "Muat ulang dashboard";
const LOGIN_ACTION_LABEL = "Kembali ke login";

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDueDate(dateValue: string | null) {
  if (!dateValue) {
    return "Jadwal jatuh tempo belum tersedia";
  }

  return `Jatuh tempo: ${new Date(dateValue).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function getPackageName(profileData: DashboardSummary["profile"]["data"]) {
  return profileData?.paket?.nama ?? "Belum berlangganan";
}

function getSpeedLabel(profileData: DashboardSummary["profile"]["data"]) {
  const bandwidth = profileData?.paket?.bandwidth;

  if (!bandwidth) {
    return "Tidak tersedia";
  }

  if (typeof bandwidth.download === "number") {
    return `${bandwidth.download} Mbps`;
  }

  return bandwidth.download;
}

function buildDashboardResourceUrl() {
  return "/api/customer/dashboard/summary";
}

function normalizeDashboardError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Gagal memuat dashboard");
}

export function getDashboardFailureState(
  error: Error | null,
): DashboardFailureState {
  if (
    error instanceof DashboardHttpError &&
    (error.status === 401 || error.status === 403)
  ) {
    return {
      title: "Sesi pelanggan sudah berakhir",
      description: AUTHENTICATION_ERROR_MESSAGE,
      actionHref: "/login",
      actionLabel: LOGIN_ACTION_LABEL,
    };
  }

  return {
    title: "Dashboard pelanggan belum bisa dimuat",
    description: error?.message ?? DEFAULT_DASHBOARD_ERROR_MESSAGE,
    actionHref: "/dashboard",
    actionLabel: RETRY_DASHBOARD_LABEL,
  };
}

export function CustomerDashboardContent({
  customerId,
  customerName,
  summary,
  isLoading,
  dashboardError,
}: CustomerDashboardContentProps) {
  const profileSection = summary?.profile ?? null;
  const connectionSection = summary?.connection ?? null;
  const billingSection = summary?.billing ?? null;

  const packageName = useMemo(
    () => getPackageName(profileSection?.data ?? null),
    [profileSection],
  );
  const speedLabel = useMemo(
    () => getSpeedLabel(profileSection?.data ?? null),
    [profileSection],
  );
  const isOnline =
    connectionSection?.state === "ready"
      ? (connectionSection.data?.isOnline ?? false)
      : false;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] dark:bg-[#101922]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0d9488] border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {INITIAL_LOAD_LABEL}
          </p>
        </div>
      </div>
    );
  }

  if (dashboardError || !summary) {
    const failureState = getDashboardFailureState(dashboardError);

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-6 text-center dark:bg-[#101922]">
        <div className="max-w-sm space-y-3 rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/40 dark:bg-[#1c2936]">
          <h1 className="text-lg font-bold text-[#111418] dark:text-white">
            {failureState.title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {failureState.description}
          </p>
          <Link href={failureState.actionHref} className="inline-flex">
            <Button variant="outline">{failureState.actionLabel}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#f6f7f8] text-[#111418] antialiased transition-colors duration-200 dark:bg-[#101922] dark:text-white"
      data-customer-id={customerId}
    >
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden bg-[#f6f7f8] shadow-xl dark:bg-[#101922]">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-[#f6f7f8] p-4 pb-2 dark:border-gray-800 dark:bg-[#101922]">
          <div className="flex size-10 shrink-0 items-center" />
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">
              Dashboard
            </h2>
          </div>
          <div className="flex size-10 items-center justify-end">
            <CustomerNotificationBell />
          </div>
        </div>

        <div className="flex flex-1 flex-col pb-24">
          <div className="px-4 pb-2 pt-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Selamat datang kembali,
            </p>
            <h2 className="text-2xl font-bold leading-tight text-[#111418] dark:text-white">
              {customerName}
            </h2>
          </div>

          <div className="p-4">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1c2936]">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-teal-50 text-[#0d9488] dark:bg-teal-900/20">
                    <MdRouter className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight dark:text-white">
                      Internet Rumah
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      {packageName}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isOnline ? "bg-green-400" : "bg-red-400"}`}
                        />
                        <span
                          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
                        />
                      </span>
                      <span
                        className={`text-xs font-semibold ${isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {connectionSection?.state === "ready"
                          ? isOnline
                            ? "Aktif & Stabil"
                            : "Gangguan / Offline"
                          : CONNECTION_ERROR_LABEL}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="flex flex-col rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                    Kecepatan
                  </span>
                  <div className="flex items-center gap-1.5">
                    <MdBolt className="text-lg text-[#0d9488]" />
                    <span className="text-sm font-bold dark:text-white">
                      {speedLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                    Status Perangkat
                  </span>
                  <div className="flex items-center gap-1.5">
                    <MdCheckCircle className="text-lg text-[#0d9488]" />
                    <span className="text-sm font-bold dark:text-white">
                      {connectionSection?.state === "ready"
                        ? isOnline
                          ? "Normal"
                          : "Perlu pengecekan"
                        : CONNECTION_ERROR_LABEL}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#0d9488] to-[#115e59] p-5 text-white shadow-lg">
              <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-sm font-medium text-teal-100">
                      Tagihan Bulan Ini
                    </p>
                    <h3 className="text-3xl font-bold tracking-tight">
                      {billingSection?.state === "ready" && billingSection.data
                        ? formatCurrency(billingSection.data.outstandingAmount)
                        : "Rp -"}
                    </h3>
                  </div>
                  <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                    <MdReceiptLong className="text-xl text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-2 w-2 rounded-full ${billingSection?.state === "ready" && billingSection.data && billingSection.data.outstandingCount > 0 ? "bg-orange-400" : "bg-green-400"}`}
                  />
                  <p className="text-sm font-medium text-teal-50">
                    {billingSection?.state === "ready" && billingSection.data
                      ? billingSection.data.outstandingCount > 0
                        ? formatDueDate(billingSection.data.nearestDueDate)
                        : "Tagihan lunas"
                      : BILLING_ERROR_LABEL}
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/tagihan">
                    <Button variant="outline" className="w-full">
                      <span>
                        {billingSection?.state === "ready" &&
                        billingSection.data &&
                        billingSection.data.outstandingCount > 0
                          ? "Bayar Sekarang"
                          : "Lihat Riwayat"}
                      </span>
                      <MdArrowForward className="text-sm" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4">
            <h3 className="mb-3 px-1 text-lg font-bold text-[#111418] dark:text-white">
              Menu Cepat
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/paket">
                <Button
                  variant="ghost"
                  className="group flex h-auto w-full flex-col items-start gap-3 border border-gray-100 p-0 text-left shadow-sm hover:border-[#0d9488]/50 dark:border-gray-800"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] transition-transform group-hover:scale-110 dark:bg-teal-900/20">
                    <MdDescription className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold leading-tight text-[#111418] dark:text-white">
                      Detail Layanan
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Info Paket
                    </p>
                  </div>
                </Button>
              </Link>

              <Link href="/dukungan">
                <Button
                  variant="ghost"
                  className="group flex h-auto w-full flex-col items-start gap-3 border border-gray-100 p-0 text-left shadow-sm hover:border-[#0d9488]/50 dark:border-gray-800"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 transition-transform group-hover:scale-110 dark:bg-orange-900/20">
                    <MdSupportAgent className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold leading-tight text-[#111418] dark:text-white">
                      Dukungan
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Bantuan Live
                    </p>
                  </div>
                </Button>
              </Link>

              <Link href="/riwayat">
                <Button
                  variant="ghost"
                  className="group flex h-auto w-full flex-col items-start gap-3 border border-gray-100 p-0 text-left shadow-sm hover:border-[#0d9488]/50 dark:border-gray-800"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 transition-transform group-hover:scale-110 dark:bg-purple-900/20">
                    <MdHistory className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold leading-tight text-[#111418] dark:text-white">
                      Riwayat
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Transaksi
                    </p>
                  </div>
                </Button>
              </Link>

              <Link href="/upgrade-paket">
                <Button
                  variant="ghost"
                  className="group flex h-auto w-full flex-col items-start gap-3 border border-gray-100 p-0 text-left shadow-sm hover:border-[#0d9488]/50 dark:border-gray-800"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-green-50 text-green-600 transition-transform group-hover:scale-110 dark:bg-green-900/20">
                    <MdRocketLaunch className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold leading-tight text-[#111418] dark:text-white">
                      Upgrade
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Tambah Kecepatan
                    </p>
                  </div>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboardClient({
  customerId,
  customerName,
}: CustomerDashboardClientProps) {
  const { data, error, isPending } = useQuery<DashboardSummary>({
    queryKey: ["customer-dashboard-summary", customerId] as const,
    queryFn: () =>
      fetchDashboardResource(
        buildDashboardResourceUrl(),
        dashboardSummarySchema,
      ),
  });
  const isLoading = isPending;

  const summary = data ?? null;
  const dashboardError = error ? normalizeDashboardError(error) : null;

  return (
    <CustomerDashboardContent
      customerId={customerId}
      customerName={customerName}
      summary={summary}
      isLoading={isLoading}
      dashboardError={dashboardError}
    />
  );
}
