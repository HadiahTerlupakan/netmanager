"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import {
  MdArrowBack,
  MdCalendarMonth,
  MdSpeed,
  MdRocketLaunch,
  MdSportsEsports,
  MdCheckCircle,
  MdArrowForward,
  MdInfo,
  MdWifiTethering,
} from "react-icons/md";

interface PackageBandwidth {
  nama: string;
  download: string | null;
  upload: string | null;
}

interface UpgradeOption {
  id: string;
  nama: string;
  harga: number;
  durasi: number;
  durasiUnit: string;
  isFeatured: boolean;
  priceDifference: number;
  bandwidth: PackageBandwidth | null;
}

interface CustomerPackageResponse {
  package: {
    nama: string;
    harga: number;
    durasi: number;
    durasiUnit: string;
    bandwidth: PackageBandwidth | null;
  };
  subscription: {
    jatuhTempo: string;
    status: string;
  };
  pendingUpgrade: {
    id: string;
    nama: string;
    applyAt: string | null;
  } | null;
  upgradeOptions: UpgradeOption[];
}

const TIER_ICONS = [MdSpeed, MdRocketLaunch, MdSportsEsports];

const DURATION_UNIT_LABELS: Record<string, string> = {
  HARI: "hari",
  MINGGU: "minggu",
  BULAN: "bulan",
  TAHUN: "tahun",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Ubah durasi paket jadi label periode tagihan, mis. "30 hari" atau "bulan". */
const formatBillingPeriod = (durasi: number, durasiUnit: string) => {
  const unitLabel =
    DURATION_UNIT_LABELS[durasiUnit] ?? durasiUnit.toLowerCase();
  return durasi === 1 ? unitLabel : `${durasi} ${unitLabel}`;
};

/** Rangkum bandwidth jadi satu baris, mis. "20M turun / 5M naik". */
const formatBandwidth = (bandwidth: PackageBandwidth | null) => {
  if (!bandwidth) return null;
  if (!bandwidth.download && !bandwidth.upload) return bandwidth.nama;
  return `${bandwidth.download ?? "-"} turun / ${bandwidth.upload ?? "-"} naik`;
};

export default function CustomerUpgradePackagePage() {
  const { isLoading: authLoading, isAuthenticated } = useCustomerAuth();
  const router = useRouter();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data,
    isLoading: packageLoading,
    refetch: refetchPackage,
  } = useApi<CustomerPackageResponse>(
    isAuthenticated ? "/api/customer/package" : null,
  );

  const currentPackage = data?.package;
  const upgradeOptions = useMemo(
    () => data?.upgradeOptions ?? [],
    [data?.upgradeOptions],
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Pilihan awal diturunkan dari data, bukan di-set lewat effect: paket unggulan
  // kalau ada, selain itu opsi termurah. Pilihan pengguna menimpanya.
  const defaultOptionId = useMemo(() => {
    if (upgradeOptions.length === 0) return null;
    const featuredOption = upgradeOptions.find((option) => option.isFeatured);
    return (featuredOption ?? upgradeOptions[0]).id;
  }, [upgradeOptions]);

  const activeOptionId = selectedPackageId ?? defaultOptionId;

  const selectedOption = useMemo(
    () => upgradeOptions.find((option) => option.id === activeOptionId),
    [upgradeOptions, activeOptionId],
  );

  const pendingUpgrade = data?.pendingUpgrade ?? null;

  const cancelUpgradeRequest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/customer/package/upgrade", {
        method: "DELETE",
      });
      const result = await response.json();

      if (!result.success) {
        setSubmitError(result.error || "Gagal membatalkan pengajuan");
        return;
      }

      await refetchPackage();
    } catch {
      setSubmitError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUpgradeRequest = async () => {
    if (!selectedOption || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/customer/package/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selectedOption.id }),
      });
      const result = await response.json();

      if (!result.success) {
        setSubmitError(result.error || "Gagal mengajukan upgrade");
        return;
      }

      await refetchPackage();
    } catch {
      setSubmitError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || packageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
        <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101922] font-sans antialiased text-[#111418] dark:text-white min-h-screen">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-56 max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922]">
        {/* Top App Bar */}
        <div className="sticky top-0 z-50 flex items-center bg-white/90 dark:bg-[#101922]/90 backdrop-blur-md p-4 border-b border-gray-200 dark:border-gray-800 justify-between">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => router.back()}
          >
            <MdArrowBack className="text-2xl" />
          </Button>
          <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Upgrade Paket
          </h2>
        </div>

        {/* Paket Saat Ini */}
        <div className="p-4 pt-6">
          <div className="flex items-stretch justify-between gap-4 rounded-xl bg-white dark:bg-[#1c2732] p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col justify-center gap-1 flex-[2_2_0px]">
              <p className="text-[#617589] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Paket Saat Ini
              </p>
              <p className="text-[#111418] dark:text-white text-lg font-bold leading-tight">
                {currentPackage?.nama ?? "-"}
              </p>
              {currentPackage ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(currentPackage.harga)} /{" "}
                  {formatBillingPeriod(
                    currentPackage.durasi,
                    currentPackage.durasiUnit,
                  )}
                </p>
              ) : null}
              {data?.subscription?.jatuhTempo ? (
                <div className="flex items-center gap-1 mt-1 text-[#0d9488]">
                  <MdCalendarMonth className="text-sm" />
                  <p className="text-sm font-medium leading-normal">
                    Aktif sampai {formatDate(data.subscription.jatuhTempo)}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="w-24 shrink-0 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
              <MdWifiTethering className="text-4xl text-[#0d9488]" />
            </div>
          </div>
        </div>

        {pendingUpgrade ? (
          <div className="mx-4 mt-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
            <div className="flex gap-3">
              <MdInfo className="text-xl text-[#0d9488] shrink-0" />
              <div>
                <p className="font-bold text-[#111418] dark:text-white">
                  Pengajuan upgrade sedang diproses
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {pendingUpgrade.nama} akan aktif
                  {pendingUpgrade.applyAt
                    ? ` pada ${formatDate(pendingUpgrade.applyAt)}`
                    : " pada siklus tagihan berikutnya"}
                  .
                </p>
                {submitError ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {submitError}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="mt-3"
                  disabled={isSubmitting}
                  onClick={cancelUpgradeRequest}
                >
                  {isSubmitting ? "Membatalkan..." : "Batalkan Pengajuan"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pilihan Upgrade */}
        <div className="px-4 py-2">
          <h3 className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight pb-1">
            Pilihan Upgrade
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
            Paket yang tersedia di lokasi layanan Anda.
          </p>
        </div>

        {upgradeOptions.length === 0 ? (
          <div className="mx-4 my-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1c2732] p-8 text-center">
            <MdInfo className="mx-auto text-3xl text-gray-400" />
            <p className="mt-3 font-bold text-[#111418] dark:text-white">
              Belum ada paket upgrade
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Saat ini tidak ada paket dengan harga di atas paket Anda di lokasi
              layanan ini.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-3">
            {upgradeOptions.map((option, index) => {
              const TierIcon = TIER_ICONS[index % TIER_ICONS.length];
              const isSelected = option.id === activeOptionId;
              const bandwidthLabel = formatBandwidth(option.bandwidth);

              return (
                <label
                  key={option.id}
                  className={`group relative flex flex-col gap-4 rounded-xl border-solid p-5 cursor-pointer transition-all ${
                    option.isFeatured
                      ? "border-2 border-[#0d9488] shadow-lg shadow-teal-100 dark:shadow-none"
                      : "border hover:border-[#0d9488]/50"
                  } ${
                    isSelected
                      ? "border-[#0d9488] ring-1 ring-[#0d9488] bg-teal-50/30 dark:bg-teal-900/10"
                      : "border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1c2732]"
                  }`}
                >
                  {option.isFeatured ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0d9488] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                      Direkomendasikan
                    </div>
                  ) : null}
                  <div className="absolute top-5 right-5">
                    <input
                      className="peer h-6 w-6 border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
                      name="plan_selection"
                      type="radio"
                      checked={isSelected}
                      onChange={() => setSelectedPackageId(option.id)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pr-8">
                    <div className="flex items-center gap-2">
                      <TierIcon className="text-[#0d9488] text-[28px]" />
                      <h1 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">
                        {option.nama}
                      </h1>
                    </div>
                    <p className="flex items-baseline gap-1 text-[#111418] dark:text-white mt-2">
                      <span className="text-2xl font-black leading-tight tracking-[-0.033em]">
                        {formatCurrency(option.harga)}
                      </span>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        /{formatBillingPeriod(option.durasi, option.durasiUnit)}
                      </span>
                    </p>
                  </div>
                  <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
                  <div className="flex flex-col gap-2">
                    {option.bandwidth ? (
                      <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                        <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px] shrink-0" />
                        Kecepatan {option.bandwidth.nama}
                        {bandwidthLabel &&
                        bandwidthLabel !== option.bandwidth.nama
                          ? ` (${bandwidthLabel})`
                          : ""}
                      </div>
                    ) : null}
                    <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                      <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px] shrink-0" />
                      Tambahan {formatCurrency(option.priceDifference)} dari
                      paket sekarang
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Sticky Bottom Bar */}
        {selectedOption && !pendingUpgrade ? (
          <div className="fixed bottom-20 left-0 right-0 z-40 bg-white dark:bg-[#1c2732] border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-center max-w-md mx-auto">
            <div className="flex flex-col gap-3 mx-auto max-w-2xl">
              <div className="flex justify-between items-end">
                <div className="flex flex-col items-start">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Paket Dipilih:
                  </span>
                  <span className="font-bold text-[#111418] dark:text-white text-left">
                    {selectedOption.nama}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{formatCurrency(selectedOption.priceDifference)}
                  </span>
                  <span className="font-black text-lg text-[#0d9488]">
                    {formatCurrency(selectedOption.harga)}
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                      /
                      {formatBillingPeriod(
                        selectedOption.durasi,
                        selectedOption.durasiUnit,
                      )}
                    </span>
                  </span>
                </div>
              </div>
              {submitError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              ) : null}
              <Button
                className="w-full"
                type="button"
                disabled={isSubmitting}
                onClick={submitUpgradeRequest}
              >
                <span className="truncate">
                  {isSubmitting ? "Memproses..." : "Ajukan Upgrade"}
                </span>
                <MdArrowForward className="ml-2 text-sm" />
              </Button>
              <div className="flex justify-center items-center gap-1 text-[10px] text-gray-400">
                <MdInfo className="text-[12px]" />
                <span>Paket baru berlaku mulai siklus tagihan berikutnya.</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
