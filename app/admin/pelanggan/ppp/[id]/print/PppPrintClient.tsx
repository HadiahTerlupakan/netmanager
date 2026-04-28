"use client";
import { clientLogger } from "@/lib/client-logger";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiPrinter, HiXCircle } from "react-icons/hi2";
import Image from "next/image";
import PageLoader from "@/components/ui/PageLoader";
import { normalizeLogoUrl } from "@/lib/settings/normalizeLogoUrl";

type Pelanggan = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  technicalInfo?: {
    staticIpAddress?: string | null;
    staticIpSource?: string | null;
    serverRouterName?: string | null;
    serverRouterSource?: string | null;
    odpPortValue?: string | null;
    odpPortSource?: string | null;
  } | null;
  tipe: "REGULER" | "NON_REGULER";
  alamat?: string | null;
  provinsi?: string | null;
  kabupatenKota?: string | null;
  kelurahanDesa?: string | null;
  kecamatan?: string | null;
  noTelp?: string | null;
  email?: string | null;
  tanggalAktif: string;
  jatuhTempo: string;
  usePPN: boolean;
  useDiscount: boolean;
  useProrate: boolean;
  discountType?: "FIXED" | "PERCENT" | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: "JAM" | "HARI" | "BULAN" | "TAHUN" | null;
  biayaInstalasi?: number | null;
  biayaInstalasiIsRecurring?: boolean;
  biayaInstalasiDiskon?: number | null;
  biayaSewaPerangkat?: number | null;
  biayaSewaPerangkatIsRecurring?: boolean;
  biayaSewaPerangkatDiskon?: number | null;
  biayaLainnya?: number | null;
  biayaLainnyaIsRecurring?: boolean;
  biayaLainnyaDiskon?: number | null;
  keteranganBiayaLainnya?: string | null;
  hargaPaket?: {
    id: string;
    name: string;
    harga: number;
    durasi: number;
    durasiUnit: "JAM" | "HARI" | "BULAN" | "TAHUN";
    usePPN?: boolean;
    ppnPercentage?: number | null;
    useDiscount?: boolean;
    discountType?: "FIXED" | "PERCENT" | null;
    discountValue?: number | null;
    discountDuration?: number | null;
    discountDurationUnit?: "JAM" | "HARI" | "BULAN" | "TAHUN" | null;
    profilePPP?: {
      name: string;
    } | null;
    bandwidth?: {
      name: string;
    } | null;
  } | null;
};

type Tagihan = {
  id: string;
  noTagihan: string;
  periodeBulan: number;
  periodeTahun: number;
  subtotal: number;
  diskon: number;
  ppn: number;
  biayaInstalasi: number;
  biayaSewaPerangkat: number;
  biayaLainnya: number;
  total: number;
  status: "BELUM_LUNAS" | "LUNAS" | "TERLAMBAT";
  jatuhTempo: string;
  tanggalBayar: string | null;
  metodePembayaran: string | null;
  createdAt: string;
};

type ExtendedTagihan = Omit<Tagihan, "status"> & {
  nomor?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
};

export default function PppPrintClient() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null);
  const [tagihan, setTagihan] = useState<Tagihan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPPPAccount, setShowPPPAccount] = useState(false);
  const [logoSettings, setLogoSettings] = useState<{
    logoInvoice?: string;
  } | null>(null);
  const [generalSettings, setGeneralSettings] = useState<{
    perusahaan?: string;
    alamat?: string;
    nomorHp?: string;
    deskripsiInvoice?: string;
  } | null>(null);
  const [printFormat, setPrintFormat] = useState<"A4" | "THERMAL">("A4");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch pelanggan data
        const pelangganRes = await fetch(`/api/pelanggan-ppp/${id}`);
        if (!pelangganRes.ok) {
          throw new Error("Failed to fetch pelanggan data");
        }
        const pelangganData = await pelangganRes.json();
        const pelangganPayload =
          pelangganData?.data ?? pelangganData?.pelanggan ?? pelangganData;
        if (pelangganPayload?.id) {
          setPelanggan(pelangganPayload);
        } else {
          clientLogger.error("Unknown pelanggan format", pelangganData);
        }

        // Fetch latest tagihan
        const tagihanRes = await fetch(
          `/api/tagihan/pelanggan/${id}?latest=true`,
        );
        if (tagihanRes.ok) {
          const tagihanData = await tagihanRes.json();
          clientLogger.info("PRINT TAGIHAN RES:", tagihanData);
          if (tagihanData.data?.tagihan) {
            setTagihan(tagihanData.data.tagihan);
          } else if (tagihanData.tagihan) {
            setTagihan(tagihanData.tagihan);
          }
        }

        // Fetch logo settings
        try {
          const logoRes = await fetch("/api/settings/logo/public");
          if (logoRes.ok) {
            const logoData = await logoRes.json();
            const normalizedLogoUrl = normalizeLogoUrl(logoData.logoInvoice);
            logoData.logoInvoice = normalizedLogoUrl;
            if (normalizedLogoUrl) {
              const testImg = new window.Image();
              testImg.onload = () => {
                clientLogger.info(
                  "Logo image loaded successfully:",
                  normalizedLogoUrl,
                );
              };
              testImg.onerror = () => {
                clientLogger.warn(
                  "Logo tidak dapat diakses, akan menggunakan fallback:",
                  normalizedLogoUrl,
                );
              };
              testImg.src = normalizedLogoUrl;
            }
            setLogoSettings(logoData);
          }
        } catch (_e) {
          clientLogger.warn("Failed to load logo settings");
        }

        // Fetch general settings
        try {
          const generalRes = await fetch("/api/settings/general/public");
          if (generalRes.ok) {
            const generalData = await generalRes.json();
            setGeneralSettings(generalData);
          }
        } catch (_e) {
          clientLogger.warn("Failed to load general settings");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDateShort = (dateString?: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getPeriodeAktif = () => {
    if (!pelanggan?.hargaPaket) return "";
    const { durasi, durasiUnit } = pelanggan.hargaPaket;
    const unitMap: Record<string, string> = {
      JAM: durasi === 1 ? "Jam" : "Jam",
      HARI: durasi === 1 ? "Hari" : "Hari",
      BULAN: durasi === 1 ? "Bulan" : "Bulan",
      TAHUN: durasi === 1 ? "Tahun" : "Tahun",
    };
    return `${durasi} ${unitMap[durasiUnit] || durasiUnit}`;
  };

  // Jika tagihan tidak ada secara realita, kita buat draft cetakan (Preview Mode) hanya agar fungsi Print bisa jalan (sebagai Draft)
  const currentTagihan = tagihan || {
    id: "-",
    status: "BELUM_LUNAS" as const,
    createdAt: pelanggan?.tanggalAktif || new Date().toISOString(),
    issueDate: pelanggan?.tanggalAktif || new Date().toISOString(),
    jatuhTempo:
      pelanggan?.jatuhTempo ||
      new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    dueDate:
      pelanggan?.jatuhTempo ||
      new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    total: pelanggan?.hargaPaket?.harga || 0,
    metodePembayaran: "-",
    keterangan: "Belum ada tagihan tercatat",
    nomor: "DRAFT",
    noTagihan: "DRAFT",
    invoiceNumber: "DRAFT",
    subtotal: Number(pelanggan?.hargaPaket?.harga || 0),
    ppn: 0,
    biayaInstalasi: pelanggan?.biayaInstalasi || 0,
    biayaSewaPerangkat: pelanggan?.biayaSewaPerangkat || 0,
    biayaLainnya: pelanggan?.biayaLainnya || 0,
    diskon: 0,
  };

  const invoiceCalculations = (() => {
    if (!currentTagihan) return null;

    return {
      hargaPaket: currentTagihan.subtotal, // Subtotal includes all base prices based on current mapping
      diskon: currentTagihan.diskon || 0,
      biayaInstalasi: currentTagihan.biayaInstalasi || 0,
      biayaSewa: currentTagihan.biayaSewaPerangkat || 0,
      biayaLainnya: currentTagihan.biayaLainnya || 0,
      subtotal: currentTagihan.subtotal, // Real subtotal of all items
      ppn: currentTagihan.ppn || 0,
      total: currentTagihan.total || 0,
    };
  })();
  // Helper strings
  const getAlamatLengkap = () => {
    if (!pelanggan) return "";
    return [
      pelanggan.alamat,
      pelanggan.kelurahanDesa,
      pelanggan.kecamatan,
      pelanggan.kabupatenKota,
      pelanggan.provinsi,
    ]
      .filter(Boolean)
      .join(", ");
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error || !pelanggan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-4xl text-red-500">
            <HiXCircle className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            {error ||
              (!pelanggan
                ? "Data pelanggan tidak ditemukan"
                : "Terjadi kesalahan tidak diketahui")}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400"
          >
            <span className="text-white">Kembali</span>
          </button>
        </div>
      </div>
    );
  }

  // Format nomor invoice untuk konfirmasi pelanggan ke admin
  // Support format lama (TAG-YYYYMM-XXXX) dan format baru (INVXXXXYYYYZZZZ)
  // Menampilkan nomor tagihan tanpa prefix TAG- atau INV
  let invoiceNumber =
    currentTagihan.noTagihan ||
    (currentTagihan as ExtendedTagihan).nomor ||
    (currentTagihan as ExtendedTagihan).invoiceNumber ||
    "-";
  if (invoiceNumber && invoiceNumber.startsWith("INV")) {
    // Format baru: INVXXXXYYYYZZZZ -> XXXXYYYYZZZZ
    invoiceNumber = invoiceNumber.replace(/^INV/, "");
  } else if (invoiceNumber && invoiceNumber.startsWith("TAG-")) {
    // Format lama: TAG-YYYYMM-XXXX -> YYYYMM-XXXX (tanpa prefix TAG-)
    invoiceNumber = invoiceNumber.replace(/^TAG-/, "");
  }

  return (
    <div className="min-h-screen bg-gray-50 print:h-auto print:min-h-0 print:bg-white print:overflow-visible">
      <style jsx global>{`
        @media print {
          html,
          body {
            width: auto !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Sembunyikan semua elemen layout admin */
          nav,
          aside,
          header,
          footer,
          .sidebar,
          .navbar,
          .no-print {
            display: none !important;
          }

          /* Targetkan semua wrapper layout mulai dari root hingga main */
          #__next,
          body > div,
          .min-h-screen,
          .flex-1,
          main,
          .print-content-wrapper {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .invoice-paper {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm 20mm !important; /* Gunakan padding sbg margin pengganti page */
            box-shadow: none !important;
            background: white !important;
            border: none !important;
          }

          .invoice-bill-to {
            background: transparent !important;
            padding: 0 !important;
            border: none !important;
          }

          .invoice-text-dark {
            color: black !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          @page {
            size: ${printFormat === "THERMAL" ? "58mm auto" : "A4"};
            margin: 0mm; /* Margin 0 untuk MENGHILANGKAN Date & URL bawaan Browser (Chrome/Edge) */
          }
        }
      `}</style>

      {/* Wrapper */}
      <div
        className={`print-content-wrapper bg-gray-50 dark:bg-gray-950 min-h-screen print:min-h-0 text-gray-900 ${printFormat === "THERMAL" ? "font-mono" : "font-sans"} print:bg-white print:text-black`}
      >
        {/* Control Bar */}
        <div className="print:hidden fixed top-0 right-0 left-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Preview Invoice
          </h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showPPPAccount}
                onChange={(e) => setShowPPPAccount(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Show PPP Info</span>
            </label>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            <select
              value={printFormat}
              onChange={(e) =>
                setPrintFormat(e.target.value as "A4" | "THERMAL")
              }
              className="text-sm py-1.5 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="A4">A4 Normal</option>
              <option value="THERMAL">Struk Thermal</option>
            </select>

            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-input shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (typeof window.print === "function") {
                  window.print();
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 shadow-sm flex items-center gap-2"
            >
              <HiPrinter className="w-4 h-4 text-white" />
              <span className="text-white">Print Invoice</span>
            </button>
          </div>
        </div>

        {printFormat === "THERMAL" ? (
          /* THERMAL 58mm Layout */
          <div
            className="invoice-paper mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-[5mm] pt-[8mm] shadow-2xl dark:shadow-black/30 print:shadow-none print:p-0"
            style={{ maxWidth: "58mm", width: "58mm" }}
          >
            <div className="text-center mb-3 border-b border-dashed border-gray-300 dark:border-gray-700 pb-3">
              <h1 className="font-bold text-[15px] leading-tight mb-1 text-gray-900 dark:text-gray-100">
                {generalSettings?.perusahaan || "Perusahaan"}
              </h1>
              <p className="text-[10px] leading-tight mb-0.5 text-gray-600 dark:text-gray-300">
                {generalSettings?.alamat || "-"}
              </p>
              <p className="text-[10px] leading-tight text-gray-600 dark:text-gray-300">
                {generalSettings?.nomorHp || "-"}
              </p>
              <p className="mt-2 inline-flex items-center rounded-full border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                INV {invoiceNumber}
              </p>
            </div>

            <div className="mb-3 rounded-md bg-gray-50 dark:bg-gray-800/60 px-2.5 py-2 text-[10px] text-gray-700 dark:text-gray-200">
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500 dark:text-gray-400">
                  Pelanggan
                </span>
                <span className="font-semibold text-right max-w-[55%] truncate">
                  {pelanggan.nama}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500 dark:text-gray-400">ID</span>
                <span className="font-medium">{pelanggan.idPelanggan}</span>
              </div>
              {showPPPAccount && (
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-gray-500 dark:text-gray-400">PPP</span>
                  <span className="font-mono text-right max-w-[55%] truncate">
                    {pelanggan.username}
                  </span>
                </div>
              )}
              <div className="my-1 border-t border-dashed border-gray-300 dark:border-gray-700" />
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500 dark:text-gray-400">Issued</span>
                <span>
                  {formatDateShort(
                    (currentTagihan as ExtendedTagihan).issueDate ||
                      (currentTagihan.createdAt as string),
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500 dark:text-gray-400">Tempo</span>
                <span>
                  {formatDateShort(
                    currentTagihan.jatuhTempo ||
                      ((currentTagihan as ExtendedTagihan).dueDate as string),
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2 pt-1 font-bold">
                <span>Status</span>
                <span className="uppercase">
                  {currentTagihan.status === "LUNAS" ||
                  (currentTagihan as ExtendedTagihan).status === "PAID"
                    ? "PAID"
                    : "UNPAID"}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-gray-300 dark:border-gray-700 py-2 my-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                Items
              </div>
              {pelanggan.hargaPaket && (
                <div className="text-[10px] mb-1.5 flex justify-between items-start gap-2">
                  <div className="max-w-[65%]">
                    <div className="font-medium text-gray-900 dark:text-gray-100 leading-tight">
                      {pelanggan.hargaPaket.name}
                    </div>
                    <div className="text-[9px] text-gray-500 dark:text-gray-400">
                      {getPeriodeAktif()}
                    </div>
                  </div>
                  <div className="font-medium text-right">
                    {formatRupiah(invoiceCalculations?.hargaPaket || 0)}
                  </div>
                </div>
              )}

              {invoiceCalculations?.biayaInstalasi ? (
                <div className="text-[10px] mb-1 flex justify-between gap-2">
                  <span className="text-gray-600 dark:text-gray-300">
                    Instalasi
                  </span>
                  <span>
                    {formatRupiah(invoiceCalculations.biayaInstalasi)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-md bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 py-2 px-2.5 my-3 space-y-1">
              <div className="flex justify-between text-[10px] text-gray-700 dark:text-gray-200">
                <span>Subtotal</span>
                <span>{formatRupiah(invoiceCalculations?.subtotal || 0)}</span>
              </div>
              {(invoiceCalculations?.diskon || 0) > 0 && (
                <div className="flex justify-between text-[10px] text-green-700 dark:text-green-300">
                  <span>Diskon</span>
                  <span>
                    - {formatRupiah(invoiceCalculations?.diskon || 0)}
                  </span>
                </div>
              )}
              {(invoiceCalculations?.ppn || 0) > 0 && (
                <div className="flex justify-between text-[10px] text-gray-700 dark:text-gray-200">
                  <span>PPN/Tax</span>
                  <span>{formatRupiah(invoiceCalculations?.ppn || 0)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-indigo-200 dark:border-indigo-400/20 pt-1.5 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  Total
                </span>
                <span className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">
                  {formatRupiah(invoiceCalculations?.total || 0)}
                </span>
              </div>
            </div>

            <div className="text-center text-[10px] border-t border-dashed border-gray-300 dark:border-gray-700 pt-3 mt-3 mb-2 text-gray-600 dark:text-gray-300">
              <p className="font-medium text-gray-800 dark:text-gray-100">
                Terima Kasih
              </p>
              <p>{generalSettings?.perusahaan}</p>
            </div>
          </div>
        ) : (
          /* A4 Invoice Container */
          <div className="invoice-paper max-w-[210mm] mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-[20mm] pt-[28mm] shadow-2xl dark:shadow-black/30">
            {/* Header */}
            <div className="flex justify-between items-start gap-10 border-b border-gray-200 dark:border-gray-700 print:border-gray-800 pb-8 mb-8">
              <div className="w-[58%]">
                {logoSettings?.logoInvoice ? (
                  <div className="relative h-12 w-full mb-6">
                    <Image
                      src={logoSettings.logoInvoice}
                      alt="Company Logo"
                      fill
                      className="object-contain object-left"
                      unoptimized={true}
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-500/10 rounded flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-300 font-bold text-xl">
                    {generalSettings?.perusahaan?.charAt(0) || "C"}
                  </div>
                )}
                <div className="text-sm text-gray-500 dark:text-gray-300 space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-1">
                    {generalSettings?.perusahaan}
                  </p>
                  <p>{generalSettings?.alamat}</p>
                  <p>{generalSettings?.nomorHp}</p>
                </div>
              </div>

              <div className="text-right w-[42%]">
                <h2 className="text-3xl font-light text-gray-900 dark:text-gray-100 tracking-tight mb-3">
                  INVOICE
                </h2>

                <div className="flex justify-end mb-5">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${
                      currentTagihan.status === "LUNAS" ||
                      (currentTagihan as ExtendedTagihan).status === "PAID"
                        ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/30"
                        : "bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30"
                    }`}
                  >
                    {currentTagihan.status === "LUNAS" ||
                    (currentTagihan as ExtendedTagihan).status === "PAID"
                      ? "PAID"
                      : "UNPAID"}
                  </span>
                </div>

                <dl className="space-y-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50 px-4 py-3">
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500 dark:text-gray-400 min-w-[80px] text-left">
                      Invoice #
                    </dt>
                    <dd className="font-mono font-medium text-gray-900 dark:text-gray-100 text-right">
                      {invoiceNumber}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500 dark:text-gray-400 min-w-[80px] text-left">
                      Issued
                    </dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                      {formatDateShort(
                        (currentTagihan as ExtendedTagihan).issueDate ||
                          (currentTagihan.createdAt as string),
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-500 dark:text-gray-400 min-w-[80px] text-left">
                      Due Date
                    </dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                      {formatDateShort(
                        currentTagihan.jatuhTempo ||
                          ((currentTagihan as ExtendedTagihan)
                            .dueDate as string),
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-12">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">
                Bill To
              </h3>
              <div className="invoice-bill-to bg-gray-50 dark:bg-gray-800/70 rounded-xl p-6 border border-gray-100/50 dark:border-gray-700/70 shadow-sm dark:shadow-black/10">
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-0.5">
                      {pelanggan.nama}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      ID: {pelanggan.idPelanggan}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {getAlamatLengkap() || (
                        <p className="text-gray-400 dark:text-gray-500 italic">
                          No address provided
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4 text-right">
                    {(pelanggan.noTelp || pelanggan.email) && (
                      <div className="space-y-1">
                        {pelanggan.noTelp && (
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {pelanggan.noTelp}
                          </p>
                        )}
                        {pelanggan.email && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {pelanggan.email}
                          </p>
                        )}
                      </div>
                    )}
                    {showPPPAccount && (
                      <div className="inline-block w-full max-w-[320px] text-left bg-white dark:bg-gray-900 px-3.5 py-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-black/20 break-words">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium tracking-[0.18em] mb-1">
                          PPP Account
                        </p>
                        <p className="text-sm font-mono text-gray-700 dark:text-gray-100 leading-tight break-all">
                          {pelanggan.username}
                        </p>

                        <div className="mt-3 space-y-2.5 text-xs">
                          <div className="border-t border-gray-100 dark:border-gray-800 pt-2 first:border-t-0 first:pt-0">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                              IP Address (Static)
                            </p>
                            <p className="font-mono text-gray-700 dark:text-gray-100 leading-tight break-all">
                              {pelanggan.technicalInfo?.staticIpAddress || "-"}
                            </p>
                            {pelanggan.technicalInfo?.staticIpSource ? (
                              <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500 break-words">
                                Sumber: {pelanggan.technicalInfo.staticIpSource}
                              </p>
                            ) : null}
                          </div>
                          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                              Server / Router
                            </p>
                            <p className="text-gray-700 dark:text-gray-100 leading-tight break-words">
                              {pelanggan.technicalInfo?.serverRouterName || "-"}
                            </p>
                            {pelanggan.technicalInfo?.serverRouterSource ? (
                              <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500 break-words">
                                Sumber:{" "}
                                {pelanggan.technicalInfo.serverRouterSource}
                              </p>
                            ) : null}
                          </div>
                          <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                              ODP / Port
                            </p>
                            <p className="text-gray-700 dark:text-gray-100 leading-tight break-words">
                              {pelanggan.technicalInfo?.odpPortValue || "-"}
                            </p>
                            {pelanggan.technicalInfo?.odpPortSource ? (
                              <p className="mt-0.5 text-[10px] leading-tight text-gray-400 dark:text-gray-500 break-words">
                                Sumber: {pelanggan.technicalInfo.odpPortSource}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Services Table */}
            <div className="mb-12">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-800 border-t border-gray-200 dark:border-gray-700 print:border-gray-800">
                <thead>
                  <tr className="bg-gray-50/70 dark:bg-gray-800/50 print:bg-transparent">
                    <th
                      scope="col"
                      className="py-4 pl-4 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:pl-0"
                    >
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-4 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100"
                    >
                      Period
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-4 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 print:divide-gray-400 bg-white dark:bg-gray-900">
                  {/* Main Package */}
                  {pelanggan.hargaPaket && (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0 align-top">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {pelanggan.hargaPaket.name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 mt-1 text-xs leading-relaxed">
                          {generalSettings?.deskripsiInvoice ||
                            "Internet Service Subscription"}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center align-top">
                        {getPeriodeAktif()}
                      </td>
                      <td className="px-3 py-4 text-sm font-semibold text-right text-gray-900 dark:text-gray-100 tabular-nums align-top">
                        {formatRupiah(invoiceCalculations?.hargaPaket || 0)}
                      </td>
                    </tr>
                  )}

                  {/* Fees & Discounts */}
                  {invoiceCalculations?.biayaInstalasi ? (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Installation Fee
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        -
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatRupiah(invoiceCalculations.biayaInstalasi)}
                      </td>
                    </tr>
                  ) : null}

                  {invoiceCalculations?.biayaSewa ? (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          Device Rental
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        -
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatRupiah(invoiceCalculations.biayaSewa)}
                      </td>
                    </tr>
                  ) : null}

                  {/* Discount moved to Totals Box for cleaner accounting presentation */}
                </tbody>
              </table>
            </div>

            {/* Totals Box */}
            {invoiceCalculations && (
              <div className="flex justify-end mb-12">
                <div className="w-1/2 sm:w-[42%] space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-5 shadow-sm dark:shadow-black/10">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatRupiah(invoiceCalculations.subtotal)}
                    </span>
                  </div>
                  {invoiceCalculations.diskon > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-300">
                      <span>Discount</span>
                      <span className="font-medium">
                        - {formatRupiah(invoiceCalculations.diskon)}
                      </span>
                    </div>
                  )}
                  {invoiceCalculations.ppn > 0 && (
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                      <span>
                        VAT (
                        {pelanggan.usePPN
                          ? pelanggan.hargaPaket?.ppnPercentage || 11
                          : 0}
                        %)
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatRupiah(invoiceCalculations.ppn)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between items-baseline">
                    <span className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                      Total
                    </span>
                    <span className="text-[28px] leading-none font-bold text-indigo-600 dark:text-indigo-400">
                      {formatRupiah(invoiceCalculations.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Areas */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-gray-100 dark:border-gray-800">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Payment Info
                </h4>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-1">
                  <p>
                    Make all checks payable to{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {generalSettings?.perusahaan || "Perusahaan"}
                    </span>
                  </p>
                  <p>
                    For bank transfer, please use the Invoice Number as
                    reference.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Terms & Conditions
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Service will be checked automatically upon payment. Please
                  contact support for billing discrepancies.
                </p>
              </div>
            </div>

            <div className="mt-14 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                Thank you for your business!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
