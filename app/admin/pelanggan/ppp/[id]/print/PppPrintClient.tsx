"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiPrinter, HiXCircle } from "react-icons/hi2";
import Image from "next/image";
import PageLoader from "@/components/ui/PageLoader";
import { normalizeLogoUrl } from "@/lib/settings/normalizeLogoUrl";
import { useApi } from "@/lib/hooks/useApi";

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

  const { data: pelangganRaw, error: pelangganError } = useApi<unknown>(
    id ? `/api/pelanggan-ppp/${id}` : null,
  );

  const { data: tagihanRaw } = useApi<unknown>(
    id ? `/api/tagihan/pelanggan/${id}?latest=true` : null,
  );

  const { data: logoData } = useApi<{ logoInvoice?: string | null }>(
    "/api/settings/logo/public",
  );
  const { data: generalData } = useApi<{
    namaPerusahaan?: string;
    alamat?: string;
    nomorHp?: string;
    deskripsiInvoice?: string;
  }>("/api/settings/general/public");

  // Hydrate pelanggan
  const [didHydratePel, setDidHydratePel] = useState(false);
  if (pelangganRaw && !didHydratePel) {
    setDidHydratePel(true);
    const obj = pelangganRaw as Record<string, unknown>;
    const payload =
      (obj.data as Record<string, unknown> | undefined) ??
      (obj.pelanggan as Record<string, unknown> | undefined) ??
      obj;
    if ((payload as { id?: unknown }).id) {
      setPelanggan(payload as Pelanggan);
    } else {
      clientLogger.error("Unknown pelanggan format", pelangganRaw);
    }
    setLoading(false);
  }

  if (pelangganError && !error) {
    setError(pelangganError.message || "Failed to fetch pelanggan data");
    setLoading(false);
  }

  // Hydrate tagihan
  const [didHydrateTagihan, setDidHydrateTagihan] = useState(false);
  if (tagihanRaw && !didHydrateTagihan) {
    setDidHydrateTagihan(true);
    const obj = tagihanRaw as Record<string, unknown>;
    const tagihanPayload =
      (obj.data as { tagihan?: unknown } | undefined)?.tagihan ?? obj.tagihan;
    if (tagihanPayload) {
      setTagihan(tagihanPayload as Tagihan);
    }
  }

  // Hydrate logo settings
  const [didHydrateLogo, setDidHydrateLogo] = useState(false);
  if (logoData && !didHydrateLogo) {
    setDidHydrateLogo(true);
    const normalizedLogoUrl = normalizeLogoUrl(logoData.logoInvoice ?? "");
    const next = { ...logoData, logoInvoice: normalizedLogoUrl };
    if (normalizedLogoUrl) {
      const testImg = new window.Image();
      testImg.onload = () => {
        clientLogger.info("Logo image loaded successfully:", normalizedLogoUrl);
      };
      testImg.onerror = () => {
        clientLogger.warn(
          "Logo tidak dapat diakses, akan menggunakan fallback:",
          normalizedLogoUrl,
        );
      };
      testImg.src = normalizedLogoUrl;
    }
    setLogoSettings(next);
  }

  // Hydrate general settings
  const [didHydrateGeneral, setDidHydrateGeneral] = useState(false);
  if (generalData && !didHydrateGeneral) {
    setDidHydrateGeneral(true);
    setGeneralSettings(generalData);
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateShort = (dateString?: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    // "9 Sep 2026" — 09/09/2026 ambigu dibaca lintas kebiasaan tanggal.
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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

  // Nomor invoice dicetak apa adanya. Why: pelanggan memakainya sebagai berita
  // transfer dan admin mencocokkannya di sistem, jadi harus identik. Sebelumnya
  // prefix dipotong sehingga "INV-DEV-0003" tercetak sebagai "-DEV-0003".
  const invoiceNumber =
    currentTagihan.noTagihan ||
    (currentTagihan as ExtendedTagihan).nomor ||
    (currentTagihan as ExtendedTagihan).invoiceNumber ||
    "-";

  const rawStatus = String(
    (currentTagihan as ExtendedTagihan).status ?? currentTagihan.status ?? "",
  );
  const isLunas = rawStatus === "LUNAS" || rawStatus === "PAID";
  const isTerlambat = rawStatus === "TERLAMBAT" || rawStatus === "OVERDUE";
  const statusLabel = isLunas
    ? "Lunas"
    : isTerlambat
      ? "Terlambat"
      : "Belum dibayar";

  // Identitas penerbit belum tentu diisi di pengaturan; jangan cetak baris
  // kosong atau kata "Perusahaan" sebagai nama.
  const namaPenerbit = generalSettings?.perusahaan?.trim() || "";
  const barisPenerbit = [
    generalSettings?.alamat?.trim(),
    generalSettings?.nomorHp?.trim(),
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-gray-50 print:h-auto print:min-h-0 print:bg-white print:overflow-visible">
      <style jsx global>{`
        /*
         * Dokumen cetak memakai warna kertas, bukan tema aplikasi.
         *
         * Why: tema gelap aplikasi meng-override utility abu-abu secara global,
         * sehingga pratinjau tampil gelap padahal hasil cetaknya putih —
         * pratinjau yang tidak sama dengan hasil cetak bikin orang ragu sebelum
         * mencetak. Nilai di bawah menyamai skala abu-abu Tailwind versi terang.
         */
        .invoice-paper {
          background: #ffffff !important;
          color: #111827 !important;
          color-scheme: light;
        }
        .invoice-paper .bg-gray-50,
        .invoice-paper .bg-gray-50\\/70 {
          background: #f9fafb !important;
        }
        .invoice-paper .bg-teal-50\\/70 {
          background: #f0fdfa !important;
        }
        .invoice-paper .border-teal-100 {
          border-color: #ccfbf1 !important;
        }
        .invoice-paper .border-teal-200 {
          border-color: #99f6e4 !important;
        }
        .invoice-paper .text-teal-700 {
          color: #0f766e !important;
        }
        .invoice-paper .border-gray-600,
        .invoice-paper .border-gray-300 {
          border-color: #d1d5db !important;
        }
        .invoice-paper .text-gray-800 {
          color: #1f2937 !important;
        }
        .invoice-paper .text-gray-900 {
          color: #111827 !important;
        }
        .invoice-paper .text-gray-700 {
          color: #374151 !important;
        }
        .invoice-paper .text-gray-600 {
          color: #4b5563 !important;
        }
        .invoice-paper .text-gray-500 {
          color: #6b7280 !important;
        }
        .invoice-paper .text-gray-400 {
          color: #9ca3af !important;
        }
        .invoice-paper .text-teal-700 {
          color: #0f766e !important;
        }
        .invoice-paper .text-red-700 {
          color: #b91c1c !important;
        }
        .invoice-paper .border-gray-900 {
          border-color: #111827 !important;
        }
        .invoice-paper .border-gray-300 {
          border-color: #d1d5db !important;
        }
        .invoice-paper .border-gray-200 {
          border-color: #e5e7eb !important;
        }
        .invoice-paper .border-teal-600 {
          border-color: #0d9488 !important;
        }
        .invoice-paper .border-red-600 {
          border-color: #dc2626 !important;
        }
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
            className="invoice-paper mx-auto bg-white text-gray-900 p-[5mm] pt-[8mm] shadow-2xl print:shadow-none print:p-0"
            style={{ maxWidth: "58mm", width: "58mm" }}
          >
            <div className="text-center mb-3 border-b border-dashed border-gray-300 pb-3">
              <h1 className="font-bold text-[15px] leading-tight mb-1 text-gray-900">
                {generalSettings?.perusahaan || "Perusahaan"}
              </h1>
              <p className="text-[10px] leading-tight mb-0.5 text-gray-600">
                {generalSettings?.alamat || "-"}
              </p>
              <p className="text-[10px] leading-tight text-gray-600">
                {generalSettings?.nomorHp || "-"}
              </p>
              <p className="mt-2 inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-gray-700">
                {invoiceNumber}
              </p>
            </div>

            <div className="mb-3 rounded-md bg-gray-50 px-2.5 py-2 text-[10px] text-gray-700">
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500">Pelanggan</span>
                <span className="font-semibold text-right max-w-[55%] truncate">
                  {pelanggan.nama}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500">ID</span>
                <span className="font-medium">{pelanggan.idPelanggan}</span>
              </div>
              {showPPPAccount && (
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-gray-500">PPP</span>
                  <span className="font-mono text-right max-w-[55%] truncate">
                    {pelanggan.username}
                  </span>
                </div>
              )}
              <div className="my-1 border-t border-dashed border-gray-300" />
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500">Terbit</span>
                <span>
                  {formatDateShort(
                    (currentTagihan as ExtendedTagihan).issueDate ||
                      (currentTagihan.createdAt as string),
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-0.5">
                <span className="text-gray-500">Tempo</span>
                <span>
                  {formatDateShort(
                    currentTagihan.jatuhTempo ||
                      ((currentTagihan as ExtendedTagihan).dueDate as string),
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2 pt-1 font-bold">
                <span>Status</span>
                <span>{statusLabel}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-gray-300 py-2 my-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                Rincian
              </div>
              {pelanggan.hargaPaket && (
                <div className="text-[10px] mb-1.5 flex justify-between items-start gap-2">
                  <div className="max-w-[65%]">
                    <div className="font-medium text-gray-900 leading-tight">
                      {pelanggan.hargaPaket.name}
                    </div>
                    <div className="text-[9px] text-gray-500">
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
                  <span className="text-gray-600">Instalasi</span>
                  <span>
                    {formatRupiah(invoiceCalculations.biayaInstalasi)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-md bg-teal-50/70 border border-teal-100 py-2 px-2.5 my-3 space-y-1">
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>Subtotal</span>
                <span>{formatRupiah(invoiceCalculations?.subtotal || 0)}</span>
              </div>
              {(invoiceCalculations?.diskon || 0) > 0 && (
                <div className="flex justify-between text-[10px] text-green-700">
                  <span>Diskon</span>
                  <span>
                    - {formatRupiah(invoiceCalculations?.diskon || 0)}
                  </span>
                </div>
              )}
              {(invoiceCalculations?.ppn || 0) > 0 && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>PPN</span>
                  <span>{formatRupiah(invoiceCalculations?.ppn || 0)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-teal-200 pt-1.5 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  Total
                </span>
                <span className="text-[13px] font-bold text-teal-700">
                  {formatRupiah(invoiceCalculations?.total || 0)}
                </span>
              </div>
            </div>

            <div className="text-center text-[10px] border-t border-dashed border-gray-300 pt-3 mt-3 mb-2 text-gray-600">
              <p className="font-medium text-gray-800">Terima Kasih</p>
              <p>{generalSettings?.perusahaan}</p>
            </div>
          </div>
        ) : (
          /* A4 Invoice Container */
          <div className="invoice-paper max-w-[210mm] mx-auto bg-white text-gray-900 p-[20mm] pt-[24mm] shadow-2xl print:shadow-none">
            {!namaPenerbit ? (
              <p className="print:hidden mb-6 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Identitas perusahaan belum diisi, jadi bagian penerbit di
                invoice masih kosong. Lengkapi nama, alamat, dan nomor telepon
                di Pengaturan → Umum.
              </p>
            ) : null}

            {/* Kepala dokumen: penerbit di kiri, yang harus dibayar di kanan. */}
            <div className="flex justify-between items-start gap-12 pb-8 mb-8 border-b border-gray-300">
              <div className="w-[52%]">
                {logoSettings?.logoInvoice ? (
                  /*
                   * Kotak logo dibatasi tinggi DAN lebar, bukan tinggi tetap.
                   *
                   * Why: sebelumnya kotaknya h-11 selebar kolom (rasio ~7),
                   * sehingga logo berbentuk kotak atau potret terkunci di
                   * tinggi 44px dan hanya memakai sebagian kecil ruang —
                   * logo 1536x1024 tercetak cuma 66px. Dengan dua batas ini
                   * `object-contain` menyesuaikan sendiri: logo lebar dibatasi
                   * lebarnya, logo tinggi/kotak dibatasi tingginya.
                   */
                  <div className="relative mb-5 h-[20mm] w-full max-w-[60mm]">
                    <Image
                      src="/api/settings/logo/trimmed/invoice"
                      alt={namaPenerbit || "Logo"}
                      fill
                      sizes="60mm"
                      className="object-contain object-left"
                      unoptimized={true}
                    />
                  </div>
                ) : null}
                {namaPenerbit ? (
                  <p className="text-lg font-semibold leading-snug text-gray-900">
                    {namaPenerbit}
                  </p>
                ) : null}
                {barisPenerbit.length > 0 ? (
                  <div className="mt-1 space-y-0.5 text-sm leading-relaxed text-gray-600">
                    {barisPenerbit.map((baris) => (
                      <p key={baris}>{baris}</p>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="w-[48%] text-right">
                <p className="text-sm text-gray-500">Tagihan</p>
                <p className="mt-0.5 font-mono text-base font-medium tracking-tight text-gray-900">
                  {invoiceNumber}
                </p>

                <p className="mt-6 text-sm text-gray-500">
                  {isLunas ? "Telah dibayar" : "Jumlah tagihan"}
                </p>
                <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-gray-900">
                  {formatRupiah(invoiceCalculations?.total || 0)}
                </p>

                <p
                  className={`mt-3 inline-flex items-center gap-2 border-t-2 pt-2 text-sm ${
                    isLunas
                      ? "border-teal-600 text-teal-700"
                      : isTerlambat
                        ? "border-red-600 text-red-700"
                        : "border-gray-900 text-gray-700"
                  }`}
                >
                  <span className="font-medium">{statusLabel}</span>
                  {!isLunas ? (
                    <span className="text-gray-500">
                      jatuh tempo{" "}
                      {formatDateShort(
                        currentTagihan.jatuhTempo ||
                          ((currentTagihan as ExtendedTagihan)
                            .dueDate as string),
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      {formatDateShort(
                        (currentTagihan as Tagihan).tanggalBayar,
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Penerima tagihan + tanggal dokumen, dipisah garis rambut. */}
            <div className="mb-10 grid grid-cols-[1fr_auto] gap-12 border-b border-gray-200 pb-8">
              <div>
                <p className="text-sm text-gray-500">Ditagihkan kepada</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {pelanggan.nama}
                </p>
                <p className="font-mono text-xs text-gray-500">
                  {pelanggan.idPelanggan}
                </p>
                {getAlamatLengkap() ? (
                  <div className="mt-2 max-w-[62ch] text-sm leading-relaxed text-gray-600">
                    {getAlamatLengkap()}
                  </div>
                ) : null}
                {pelanggan.noTelp || pelanggan.email ? (
                  <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                    {pelanggan.noTelp ? <p>{pelanggan.noTelp}</p> : null}
                    {pelanggan.email ? <p>{pelanggan.email}</p> : null}
                  </div>
                ) : null}
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Diterbitkan</dt>
                  <dd className="tabular-nums text-gray-900">
                    {formatDateShort(
                      (currentTagihan as ExtendedTagihan).issueDate ||
                        (currentTagihan.createdAt as string),
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Masa layanan</dt>
                  <dd className="text-gray-900">{getPeriodeAktif() || "-"}</dd>
                </div>
              </dl>
            </div>

            {showPPPAccount && (
              <div className="mb-10 border border-gray-200 px-5 py-4">
                <p className="text-sm text-gray-500">Data teknis sambungan</p>
                <dl className="mt-2 grid grid-cols-4 gap-6 text-sm">
                  <div>
                    <dt className="text-gray-500">Akun PPP</dt>
                    <dd className="font-mono break-all text-gray-900">
                      {pelanggan.username}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">IP statis</dt>
                    <dd className="font-mono break-all text-gray-900">
                      {pelanggan.technicalInfo?.staticIpAddress || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Server / router</dt>
                    <dd className="break-words text-gray-900">
                      {pelanggan.technicalInfo?.serverRouterName || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">ODP / port</dt>
                    <dd className="break-words text-gray-900">
                      {pelanggan.technicalInfo?.odpPortValue || "-"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Rincian layanan */}
            <table className="mb-10 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-900">
                  <th className="pb-2 text-left font-medium text-gray-900">
                    Layanan
                  </th>
                  <th className="pb-2 text-left font-medium text-gray-900">
                    Masa
                  </th>
                  <th className="pb-2 text-right font-medium text-gray-900">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody>
                {pelanggan.hargaPaket && (
                  <tr className="border-b border-gray-200">
                    <td className="py-3 pr-4 align-top">
                      <span className="font-medium text-gray-900">
                        {pelanggan.hargaPaket.name}
                      </span>
                      {generalSettings?.deskripsiInvoice ? (
                        <span className="mt-0.5 block text-gray-500">
                          {generalSettings.deskripsiInvoice}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 align-top text-gray-600">
                      {getPeriodeAktif()}
                    </td>
                    <td className="py-3 text-right align-top tabular-nums text-gray-900">
                      {formatRupiah(invoiceCalculations?.hargaPaket || 0)}
                    </td>
                  </tr>
                )}

                {invoiceCalculations?.biayaInstalasi ? (
                  <tr className="border-b border-gray-200">
                    <td className="py-3 pr-4 text-gray-900">
                      Biaya pemasangan
                    </td>
                    <td className="py-3 pr-4 text-gray-600">Sekali bayar</td>
                    <td className="py-3 text-right tabular-nums text-gray-900">
                      {formatRupiah(invoiceCalculations.biayaInstalasi)}
                    </td>
                  </tr>
                ) : null}

                {invoiceCalculations?.biayaSewa ? (
                  <tr className="border-b border-gray-200">
                    <td className="py-3 pr-4 text-gray-900">Sewa perangkat</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {getPeriodeAktif()}
                    </td>
                    <td className="py-3 text-right tabular-nums text-gray-900">
                      {formatRupiah(invoiceCalculations.biayaSewa)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Perhitungan */}
            {invoiceCalculations && (
              <div className="mb-12 flex justify-end">
                <dl className="w-[46%] text-sm">
                  <div className="flex justify-between gap-8 py-1.5">
                    <dt className="text-gray-600">Subtotal</dt>
                    <dd className="tabular-nums text-gray-900">
                      {formatRupiah(invoiceCalculations.subtotal)}
                    </dd>
                  </div>
                  {invoiceCalculations.diskon > 0 && (
                    <div className="flex justify-between gap-8 py-1.5">
                      <dt className="text-gray-600">Diskon</dt>
                      <dd className="tabular-nums text-gray-900">
                        −{formatRupiah(invoiceCalculations.diskon)}
                      </dd>
                    </div>
                  )}
                  {invoiceCalculations.ppn > 0 && (
                    <div className="flex justify-between gap-8 py-1.5">
                      <dt className="text-gray-600">
                        PPN{" "}
                        {pelanggan.usePPN
                          ? pelanggan.hargaPaket?.ppnPercentage || 11
                          : 0}
                        %
                      </dt>
                      <dd className="tabular-nums text-gray-900">
                        {formatRupiah(invoiceCalculations.ppn)}
                      </dd>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between gap-8 border-t border-gray-900 pt-3">
                    <dt className="font-semibold text-gray-900">
                      {isLunas ? "Total dibayar" : "Total tagihan"}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums leading-none text-gray-900">
                      {formatRupiah(invoiceCalculations.total)}
                    </dd>
                  </div>
                  {isLunas && (currentTagihan as Tagihan).metodePembayaran ? (
                    <div className="mt-3 flex justify-between gap-8 text-gray-500">
                      <dt>Metode</dt>
                      <dd className="text-gray-700">
                        {(currentTagihan as Tagihan).metodePembayaran}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            {/* Kaki dokumen */}
            <div className="grid grid-cols-2 gap-12 border-t border-gray-200 pt-6 text-sm">
              <div>
                <p className="font-medium text-gray-900">Cara pembayaran</p>
                <p className="mt-1 leading-relaxed text-gray-600">
                  Cantumkan nomor tagihan{" "}
                  <span className="font-mono text-gray-900">
                    {invoiceNumber}
                  </span>{" "}
                  pada berita transfer
                  {namaPenerbit ? ` ke ${namaPenerbit}` : ""}, atau bayar
                  langsung lewat portal pelanggan.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">Ketentuan</p>
                <p className="mt-1 leading-relaxed text-gray-600">
                  Layanan aktif kembali otomatis setelah pembayaran
                  terverifikasi. Bila ada selisih tagihan, hubungi kami sebelum
                  jatuh tempo.
                </p>
              </div>
            </div>

            <p className="mt-10 text-xs text-gray-400">
              Dokumen ini diterbitkan secara elektronik dan sah tanpa tanda
              tangan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
