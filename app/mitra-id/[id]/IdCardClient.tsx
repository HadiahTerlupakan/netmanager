"use client";

import { clientLogger } from "@/lib/client-logger";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { HiPrinter, HiArrowLeft, HiArrowDownTray } from "react-icons/hi2";
import html2canvas from "html2canvas";
import Link from "next/link";
import QRCode from "react-qr-code";

interface MitraData {
  id: string;
  name: string | null;
  mitraType: "MITRA_TEKNISI" | "MITRA_SALES";
  nik: string | null;
  fotoDiri: string | null;
  phone: string | null;
  createdAt: string;
  sites: { name: string } | null;
}

export default function IdCardClient({ mitra }: { mitra: MitraData }) {
  const isSales = mitra.mitraType === "MITRA_SALES";

  // Check if we are viewing this inside the Mobile App WebView
  const searchParams = useSearchParams();
  const isMobileApp = searchParams.get("mode") === "mobile";
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, rotate: false });
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate scale dynamically so the card fits the screen
  useEffect(() => {
    if (isMobileApp && typeof window !== "undefined") {
      const calculateScale = () => {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // If screen is narrow (portrait phone), rotate it to landscape and scale to width
        if (screenHeight > screenWidth) {
          // Portrait phone: rotate 90deg, scale to touch edges
          // Card height is 323.5px, so we scale it to fit screenHeight (leaving space for button)
          const availableHeight = screenHeight - 140;
          const availableWidth = screenWidth - 24;

          // We want the 323.5px width to fit the screen's height, and 204px height to fit screen's width
          const scaleToFitHeight = availableHeight / 323.5;
          const scaleToFitWidth = availableWidth / 204;

          const scale = Math.min(scaleToFitHeight, scaleToFitWidth);
          setScaleInfo({ scale, rotate: true });
        } else {
          // Landscape phone: don't rotate, scale to fit width/height
          const availableWidth = screenWidth - 32;
          const availableHeight = screenHeight - 32;
          const scaleToFitWidth = availableWidth / 323.5;
          const scaleToFitHeight = availableHeight / 204;
          const scale = Math.min(scaleToFitWidth, scaleToFitHeight, 1.5); // Cap at 1.5x
          setScaleInfo({ scale, rotate: false });
        }
      };

      calculateScale();
      window.addEventListener("resize", calculateScale);
      return () => window.removeEventListener("resize", calculateScale);
    }
  }, [isMobileApp]);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      setIsDownloading(true);

      // Generate canvas with optimal settings for sharp text
      const canvas = await html2canvas(cardRef.current, {
        scale: 4, // Higher scale for better print quality (300dpi approx)
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      // Convert to image and download
      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.href = image;
      link.download = `ID-Card-${mitra.name?.replace(/\s+/g, "-") || "Mitra"}.png`;
      link.click();
    } catch (error) {
      clientLogger.error("Failed to download ID card", error);
      alert("Gagal mendownload ID Card. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className={`w-full max-w-lg mx-auto flex flex-col items-center relative ${isMobileApp ? "h-screen overflow-hidden bg-slate-900 pb-0" : ""}`}
    >
      {/* Action Bar - Hidden on print and mobile mode */}
      {!isMobileApp && (
        <>
          <div className="w-full flex justify-between items-center mb-8 print:hidden">
            <Link
              href="/admin/mitra"
              className="text-gray-500 hover:text-gray-900 flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
            >
              <HiArrowLeft /> Kembali
            </Link>
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2"
            >
              <HiPrinter /> Print ID Card
            </button>
          </div>

          <div className="text-center mb-6 print:hidden">
            <p className="text-sm text-gray-500 max-w-md">
              Gunakan cetak ukuran asli atau{" "}
              <strong>ID-1 (85.6mm x 53.98mm)</strong>. Pastikan opsi{" "}
              <em>&apos;Print Background Graphics&apos;</em> diaktifkan pada
              pengaturan browser printer Anda.
            </p>
          </div>
        </>
      )}

      {/* THE ID CARD - KTP Size ID-1: 85.6mm x 53.98mm */}
      <div
        className={`relative w-full flex justify-center ${isMobileApp ? "items-center mt-auto mb-auto" : "mt-8 print:mt-0 overflow-visible"}`}
        style={
          isMobileApp
            ? {
                transformOrigin: "center center",
                transform: `scale(${scaleInfo.scale}) ${scaleInfo.rotate ? "rotate(90deg)" : ""}`,
              }
            : {}
        }
      >
        {/* The element we actually want to capture without transforms */}
        <div
          ref={cardRef}
          className="bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden relative print:shadow-none print:m-0 print:border print:border-gray-200 print:scale-100"
          style={{
            width: "323.5px",
            height: "204px",
            minWidth: "323.5px",
            minHeight: "204px",
            boxSizing: "border-box",
            display: "block",
          }}
        >
          {/* Header Pattern */}
          <div
            className={`absolute top-0 left-0 right-0 h-[45px] w-full flex items-center justify-between px-4 ${isSales ? "bg-gradient-to-r from-purple-700 to-purple-500" : "bg-gradient-to-r from-indigo-700 to-blue-500"}`}
            style={{
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          >
            <div className="flex flex-col">
              <div className="text-white font-black tracking-widest text-[11px] flex items-center gap-1.5 leading-none">
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                NETMANAGER
              </div>
              <div className="text-white/80 text-[5.5px] font-bold tracking-[0.2em] pl-5 mt-1 uppercase">
                Broadband & IT Solutions
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-bold text-[8px] uppercase tracking-widest leading-none drop-shadow-sm">
                KARTU IDENTITAS
              </div>
              <div
                className={`inline-block mt-1 px-1.5 py-[2px] rounded-sm text-[5.5px] font-bold tracking-widest uppercase ${isSales ? "bg-purple-900/50 text-white" : "bg-blue-900/50 text-white"}`}
              >
                MITRA RESMI
              </div>
            </div>
          </div>

          <div
            className="absolute top-[45px] left-0 right-0 bottom-[12px] px-4 py-3 bg-white flex"
            style={{
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
              backgroundColor: "white",
            }}
          >
            {/* Left Column: Photo */}
            <div className="w-[70px] flex flex-col items-center z-10">
              <div
                className="w-[70px] h-[90px] bg-slate-50 rounded shadow-sm overflow-hidden border border-slate-200"
                style={{
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              >
                {mitra.fotoDiri ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mitra.fotoDiri}
                      alt="Foto Profil"
                      className="w-full h-full object-cover"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                    <svg
                      className="w-8 h-8 mb-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-[5px] font-bold tracking-widest text-slate-400">
                      NON FOTO
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Info Data */}
            <div className="ml-4 flex-1 flex flex-col pt-1 z-10 border-none">
              <div className="mb-[6px]">
                <h2
                  className={`font-black text-slate-900 leading-[1.1] uppercase tracking-tight truncate w-[200px] ${mitra.name && mitra.name.length > 20 ? "text-[11px]" : "text-[13px]"}`}
                >
                  {mitra.name}
                </h2>
                <p
                  className={`text-[7px] font-bold mt-[2px] uppercase tracking-widest ${isSales ? "text-purple-600" : "text-blue-600"}`}
                >
                  {isSales ? "Sales Agent" : "Field Technician"}
                </p>
              </div>

              <div className="space-y-[6px] mt-1 flex flex-col overflow-hidden max-w-[200px]">
                <div>
                  <p className="text-[5px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                    Mitra ID
                  </p>
                  <p className="text-[8.5px] font-bold text-slate-800 font-mono tracking-widest leading-none">
                    {mitra.id.substring(0, 10).toUpperCase()}
                  </p>
                </div>
                {mitra.nik && (
                  <div>
                    <p className="text-[5px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                      NIK / KTP
                    </p>
                    <p className="text-[8.5px] font-bold text-slate-800 leading-none">
                      {mitra.nik}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[5px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                    Branch / Site
                  </p>
                  <p className="text-[8.5px] font-bold text-slate-800 leading-none truncate w-full max-w-[170px]">
                    {mitra.sites?.name || "Kantor Pusat"}
                  </p>
                </div>
              </div>
            </div>

            {/* Watermark Logo absolute positioned behind the text */}
            <div
              className="absolute right-[-10px] bottom-[-20px] opacity-[0.03] text-slate-900 pointer-events-none z-0 overflow-hidden"
              style={{
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            >
              <svg
                className="w-40 h-40"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>

            {/* QR Code on Bottom Right */}
            <div className="absolute right-4 bottom-3 flex flex-col items-center z-20">
              <div
                className="bg-white p-[2px] border border-slate-200 rounded-sm shadow-sm"
                style={{
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              >
                <QRCode
                  value={`https://netmanager.app/mitra-id/${mitra.id}`}
                  size={36}
                  level="M"
                />
              </div>
              <p className="text-[4px] font-black tracking-widest text-slate-400 mt-[3px] text-center w-full uppercase leading-none">
                SCAN TO VERIFY
              </p>
            </div>
          </div>

          {/* Footer Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-[12px] w-full flex items-center justify-between px-4 border-t ${isSales ? "bg-purple-50/50 border-purple-100/50" : "bg-slate-50 border-slate-200"}`}
            style={{
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          >
            <p className="text-[4.5px] font-bold tracking-widest text-slate-400 uppercase m-0 p-0 leading-none">
              Property of NetManager
            </p>
            <p
              className={`text-[4.5px] font-bold tracking-widest uppercase m-0 p-0 leading-none ${isSales ? "text-purple-600" : "text-blue-600"}`}
            >
              Terdaftar:{" "}
              {format(new Date(mitra.createdAt), "dd MMM yyyy", {
                locale: idLocale,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Actions Overlay */}
      {isMobileApp && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center w-full px-6 z-50">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-indigo-600 active:bg-indigo-800 text-white font-bold py-4 px-8 rounded-full shadow-xl flex items-center justify-center gap-3 w-full max-w-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <HiArrowDownTray className="w-6 h-6" />
            <span className="text-base">
              {isDownloading
                ? "Menyiapkan ID Card..."
                : "Simpan ke Galeri / HP"}
            </span>
          </button>
        </div>
      )}
      <style jsx global>{`
        @media print {
          @page {
            size: 85.6mm 53.98mm;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: transparent !important;
          }
          #__next,
          main {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
