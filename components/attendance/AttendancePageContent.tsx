"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  MdNearMe,
  MdWorkHistory,
  MdLogin,
  MdCheckCircle,
  MdLogout,
  MdPending,
  MdFingerprint,
  MdRefresh,
  MdClose,
  MdAnalytics,
} from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { KaryawanNotificationBell } from "@/components/karyawan/KaryawanNotificationBell";
import { useKaryawanAuth } from "@/components/karyawan/KaryawanAuthProvider";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { AttendanceStatusIndicator } from "./AttendanceStatusIndicator";
import { GeofenceStatusBadge } from "./GeofenceStatusBadge";
import { AttendanceAnalytics } from "./AttendanceAnalytics";
import { clientLogger } from "@/lib/client-logger";

interface AttendancePageContentProps {
  holidayInfo?: {
    description: string;
    isNational: boolean;
  } | null;
}

export default function AttendancePageContent({
  holidayInfo,
}: AttendancePageContentProps) {
  const { user } = useKaryawanAuth();

  // Logic States
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [address, setAddress] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "checked-in" | "checked-out">(
    "idle",
  );
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<"ON_TIME" | "LATE">(
    "ON_TIME",
  );
  const [workingHourMode, setWorkingHourMode] = useState<
    "FIXED" | "SHIFT" | "FLEXIBLE"
  >("FIXED");
  const [targetHours, setTargetHours] = useState(8);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const geofenceStatus: "INSIDE" | "OUTSIDE" | "UNKNOWN" = "UNKNOWN";
  const geofenceDistance: number | null = null;

  // Camera & Location States
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Geofencing State - REMOVED as per user request
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Clock State

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch("/api/attendance/status"),
        fetch("/api/attendance/history?limit=5"),
      ]);
      const statusData = await statusRes.json();
      const historyData = await historyRes.json();

      if (historyData.success) {
        setHistory(historyData.data);
      }

      if (statusData.success) {
        const currentStatus = statusData.data as {
          status: "idle" | "checked-in" | "checked-out";
          checkInTime: string | null;
          checkOutTime: string | null;
          checkInAt: string | null;
          checkOutAt: string | null;
          attendanceStatus: "ON_TIME" | "LATE" | null;
          workingHourMode?: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
          flexibleTargetHour?: number | null;
        };

        setStatus(currentStatus.status);
        setAttendanceStatus(
          currentStatus.attendanceStatus === "LATE" ? "LATE" : "ON_TIME",
        );
        setWorkingHourMode(
          currentStatus.workingHourMode === "SHIFT"
            ? "SHIFT"
            : currentStatus.workingHourMode === "FLEXIBLE"
              ? "FLEXIBLE"
              : "FIXED",
        );
        setTargetHours(currentStatus.flexibleTargetHour || 8);

        if (currentStatus.status === "idle") {
          setCheckInTime(null);
          setCheckOutTime(null);
          setCheckInDate(null);
          setCheckOutDate(null);
        } else {
          setCheckInTime(currentStatus.checkInTime);
          setCheckOutTime(currentStatus.checkOutTime);
          setCheckInDate(
            currentStatus.checkInAt ? new Date(currentStatus.checkInAt) : null,
          );
          setCheckOutDate(
            currentStatus.checkOutAt
              ? new Date(currentStatus.checkOutAt)
              : null,
          );
        }
      }
    } catch (error) {
      clientLogger.error("Failed to fetch status", error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Camera Logic
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        // Explicitly disable the track
        track.enabled = false;
      });
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    // Ensure any existing stream is fully stopped
    stopCamera();

    setShowCamera(true);
    setPhoto(null);

    try {
      // Add a small delay to ensure device is released
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Prefer front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play logic for some mobile browsers
        try {
          await videoRef.current.play();
        } catch (_e) {
          clientLogger.error("Error checking video play", _e);
        }
      }
    } catch (_err) {
      clientLogger.error("Error accessing camera", _err);
      toast.error("Gagal mengakses kamera");
      setShowCamera(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        // Set canvas to match video dimensions
        clientLogger.info(
          `[ABSENSI] Video dimensions: ${video.videoWidth}x${video.videoHeight}`,
        );
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          clientLogger.warn(
            "[ABSENSI] Video dimensions zero, forcing default 640x480",
          );
          canvas.width = 640;
          canvas.height = 480;
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Draw video frame (Mirrored to match preview)
        context.save();
        context.scale(-1, 1);
        context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        context.restore();

        const W = canvas.width;
        const H = canvas.height;
        const padding = 40;

        // 1. Bottom Gradient (Simulate Timemark fade)
        const gradient = context.createLinearGradient(0, H - 400, 0, H);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.25)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.45)");
        context.fillStyle = gradient;
        context.fillRect(0, H - 450, W, 450);

        // 2. Logo "Timemark" style (Top Right)
        // We'll draw a simple Logo placeholder in Top Right
        const logoSize = 120;
        const logoX = W - logoSize - padding;
        const logoY = padding + 20;

        // Draw Logo Background (White rounded rect)
        context.fillStyle = "rgba(255, 255, 255, 0.1)";
        // Check if roundRect is supported, if not, fallback to rect
        if (typeof context.roundRect === "function") {
          context.roundRect(logoX, logoY, logoSize, 50, 10);
          context.fill();
        } else {
          context.fillRect(logoX, logoY, logoSize, 50);
        }

        context.fillStyle = "#FFD700"; // Gold color
        context.font = "bold 30px sans-serif";
        context.textAlign = "center";
        context.fillText("Net", logoX + logoSize / 2, logoY + 35);

        // 3. Information info (Bottom Left)
        context.textAlign = "left";
        context.shadowColor = "black";
        context.shadowBlur = 4;
        context.fillStyle = "rgba(255, 255, 255, 0.95)";

        // Time (Large)
        const timeString = format(new Date(), "HH:mm");
        context.font = "bold 120px sans-serif";
        context.fillText(timeString, padding, H - 220);

        // Date
        const dateString = format(new Date(), "EEEE, dd MMMM yyyy", {
          locale: id,
        });
        context.font = "bold 35px sans-serif";
        context.fillText(dateString, padding, H - 170);

        // Address (Word wrap)
        context.font = "28px sans-serif";
        const maxAddrWidth = W - padding * 2;

        // Simple word wrap logic for address
        const words = (address || "Mencari alamat...").split(" ");
        let line = "";
        let y = H - 120;
        const lineHeight = 35;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = context.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxAddrWidth && n > 0) {
            context.fillText(line, padding, y);
            line = words[n] + " ";
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        context.fillText(line, padding, y);

        // Coordinates (Below address)
        y += lineHeight + 10;
        context.font = "24px monospace";
        context.fillText(
          `Lat: ${location?.split(",")[0]} Long: ${location?.split(",")[1] || ""}`,
          padding,
          y,
        );

        // User Name (Bottom Right or Below coords?) - Let's put it below coords
        y += lineHeight + 10;
        if (user?.name) {
          context.font = "bold 24px sans-serif";
          context.fillText(`Member: ${user.name}`, padding, y);
        }

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setPhoto(dataUrl);
        stopCamera();
        setShowCamera(false);
      }
    }
  };

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await res.json();
      if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch address:", error);
    }
  }, []);

  const getLocationPromise = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const loc = `${lat},${lng}`;

          setLocation(loc);
          setCoords({ latitude: lat, longitude: lng });
          fetchAddress(lat, lng);
          resolve(loc);
        },
        (err) => {
          clientLogger.error("Geo error", err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, [fetchAddress]);

  const getLocation = useCallback(async () => {
    if (navigator.geolocation) {
      toast.loading("Mencari lokasi...", { id: "geo-loading" });
      const loc = await getLocationPromise();
      toast.dismiss("geo-loading");
      if (loc) {
        toast.success("Lokasi berhasil didapatkan");
      } else {
        toast.error("Gagal mendapatkan lokasi. Pastikan GPS aktif.");
      }
    } else {
      toast.error("Browser tidak mendukung geolocation");
    }
  }, [getLocationPromise]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Helper to convert Data URL to Blob safely
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(",");
    const mime = arr[0]?.match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1] || "");
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleAttendance = async () => {
    clientLogger.info("[ABSENSI] handleAttendance triggered", {
      status,
      photo: photo ? "exists" : "null",
      location,
    });

    if (!photo) {
      toast.error("Foto selfie wajib diambil");
      return;
    }

    const toastId = toast.loading("Memproses absensi...");
    setLoading(true);

    try {
      clientLogger.info("[ABSENSI] Converting photo to blob...");

      let file: File;
      try {
        // Primary method: Use safer conversion
        const blob = dataURLtoBlob(photo);
        file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        clientLogger.info("[ABSENSI] Blob created:", file.size, file.type);
      } catch (_blobError) {
        clientLogger.error(
          "[ABSENSI] Blob conversion failed, trying fetch method:",
          _blobError,
        );
        // Fallback method: Use fetch API
        const response = await fetch(photo);
        const blob = await response.blob();
        file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        clientLogger.info(
          "[ABSENSI] Fallback blob created:",
          file.size,
          file.type,
        );
      }

      // Ensure location is present
      let finalLocation = location;
      if (!finalLocation) {
        toast.loading("Sedang mengambil data lokasi...", { id: toastId });
        finalLocation = await getLocationPromise();
      }

      const formData = new FormData();
      formData.append("photo", file);
      if (finalLocation) formData.append("location", finalLocation);

      // Add coordinates for backend validation
      if (coords) {
        formData.append("latitude", coords.latitude.toString());
        formData.append("longitude", coords.longitude.toString());
      }

      const endpoint =
        status === "idle"
          ? "/api/attendance/check-in"
          : "/api/attendance/check-out";
      clientLogger.info("[ABSENSI] Sending request to:", endpoint);

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include", // Ensure cookies are sent
      });
      clientLogger.info("[ABSENSI] Response received:", response.status);

      if (!response.ok) {
        const errData = await response.json();
        clientLogger.error("[ABSENSI] Server error:", errData);
        throw new Error(errData.error || "Gagal melakukan absensi");
      }

      const data = await response.json();
      clientLogger.info("[ABSENSI] Success data:", data);

      toast.dismiss(toastId);
      toast.success(
        status === "idle" ? "Check-in Berhasil!" : "Check-out Berhasil!",
      );
      setPhoto(null);
      await fetchStatus();

      // Delay agar user dapat melihat pesan sukses
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (_error) {
      toast.dismiss(toastId);
      clientLogger.error("[ABSENSI] Error in handleAttendance:", _error);
      const message =
        _error instanceof Error
          ? _error.message
          : "Terjadi kesalahan saat memproses absensi";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const renderCameraModal = () => {
    if (!showCamera) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <div className="relative w-full h-full max-w-md bg-black flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-linear-to-b from-black/50 to-transparent">
            <h3 className="text-white font-medium">Ambil Foto Selfie</h3>
            <Button
              onClick={() => {
                setShowCamera(false);
                stopCamera();
              }}
              className="p-2 rounded-full bg-white/20 text-white backdrop-blur-sm"
            >
              <MdClose size={24} />
            </Button>
          </div>

          {/* Camera/Preview Area */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Guide Frame */}
            <div className="absolute inset-0 border-32 border-black/30 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-80 border-2 border-white/50 rounded-full"></div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-linear-to-t from-black/80 to-transparent flex flex-col items-center gap-6">
            {/* Capture Button */}
            <Button onClick={capturePhoto}>
              <div className="size-16 rounded-full bg-white border-4 border-black" />
            </Button>
            <p className="text-white/80 text-sm">
              Pastikan wajah terlihat jelas
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPhotoPreviewModal = () => {
    if (!photo || showCamera) return null;

    return (
      <div className="fixed inset-0 z-100 bg-black/90 flex flex-col items-center justify-center p-4 pb-24">
        <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Preview Selfie
            </h3>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPhoto(null)}
            >
              <MdClose size={24} />
            </Button>
          </div>

          <div className="relative aspect-3/4 bg-gray-100 dark:bg-gray-900">
            <Image src={photo} alt="Preview" fill className="object-cover" />
          </div>

          <div className="p-6 flex justify-center gap-4 bg-white dark:bg-gray-800">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setPhoto(null);
                startCamera();
              }}
            >
              <MdRefresh className="text-xl" /> Ulang
            </Button>
            <Button
              size="lg"
              onClick={() => {
                handleAttendance();
              }}
              disabled={loading}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Menyimpan..."
                : status === "checked-in"
                  ? "Absen Keluar"
                  : "Absen Masuk"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 10) return "Selamat Pagi,";
    if (hour < 15) return "Selamat Siang,";
    if (hour < 18) return "Selamat Sore,";
    return "Selamat Malam,";
  };

  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased transition-colors duration-200">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl pb-24">
        {renderCameraModal()}
        {renderPhotoPreviewModal()}

        {/* Top Bar - Standardized */}
        <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex size-10 shrink-0 items-center">
            <div className="bg-linear-to-br from-blue-500 to-blue-700 rounded-full size-10 flex items-center justify-center text-white font-bold text-lg">
              {user?.name?.charAt(0)?.toUpperCase() || "K"}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">
              Absensi
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-gray-400">
              {getGreeting()}
            </p>
          </div>
          <div className="flex size-10 items-center justify-end">
            <KaryawanNotificationBell />
          </div>
        </div>

        {/* Time & Date */}
        <div className="flex flex-col items-center pt-2 pb-6 px-4">
          <div className="relative z-10 text-center">
            <h1 className="text-[42px] font-bold text-[#111418] dark:text-white tracking-tighter leading-none mb-1">
              {format(currentTime, "HH:mm")}
              <span className="text-2xl font-medium text-slate-400 ml-1"></span>
            </h1>
            <h2 className="text-slate-500 dark:text-gray-400 font-medium text-sm">
              {format(currentTime, "EEEE, d MMMM yyyy", { locale: id })}
            </h2>
          </div>
        </div>

        {/* Holiday Warning */}
        {holidayInfo && (
          <div className="px-4 pb-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
              <p className="text-red-700 dark:text-red-300 font-bold text-sm">
                Hari Libur: {holidayInfo.description}
              </p>
              {holidayInfo.isNational && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                  Absensi dinonaktifkan untuk hari libur nasional.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="px-4 w-full">
          <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-gray-800 relative overflow-hidden transition-colors">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Location Section */}
            <div className="relative w-full h-28 rounded-xl overflow-hidden mb-5 group shadow-sm bg-gray-100 dark:bg-gray-900">
              {/* We can use a better static map later, specifically requesting a location if available */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDiCTCdRfxIYEDuIQXvjeGjg9MAYh03iWivTCXqyKFx5Byh75Ax_vOUgE4u5uHeVgOP_VhdJ5YtDOgugpqJ6TUEEyaoIjfyEnpV665iPqTDjBn5nwiP5Kjfu9FFjnDpSBmwNqytA2VjtZijnJV2vWF0P_AnMsd4ky6gv6C46DVVGQ5ORuRT1FxQtkgE1MxENbYGmLHA7msbFo2bmf_w1udHRmx-vfpeQp4wQlK0myq_8eoTnrgNqW3AW5yQyn8yjxkv1w40QzNztHI")',
                }}
              ></div>
              <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>

              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white z-10">
                <div className="flex items-center justify-center size-7 rounded-full bg-white/20 backdrop-blur-md border border-white/10">
                  <MdNearMe className="text-sm text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-white/80 font-medium leading-none mb-0.5">
                    Lokasi Terkini
                  </p>
                  <p className="text-xs font-bold leading-none">
                    {location ? "Lokasi Terdeteksi" : "Mencari Lokasi..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Geofence Status */}
            <GeofenceStatusBadge
              status={geofenceStatus}
              distance={geofenceDistance}
              siteName={null}
            />

            {/* Status Info */}
            {checkInDate && (
              <AttendanceStatusIndicator
                checkInTime={checkInDate}
                {...(checkOutDate && { checkOutTime: checkOutDate })}
                targetHours={targetHours}
                workingHourMode={workingHourMode}
                status={attendanceStatus}
              />
            )}

            {!checkInDate && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                    <MdWorkHistory className="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide mb-0.5">
                      Status: Belum Absen
                    </p>
                    <p className="text-xs font-medium text-slate-600 dark:text-gray-300">
                      Silakan Check-in
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div
                className={`relative overflow-hidden p-4 rounded-xl border ${checkInTime ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 opacity-80"}`}
              >
                <div className="absolute right-0 top-0 p-2 opacity-10 pointer-events-none">
                  <MdLogin className="text-5xl text-emerald-600" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Jam Masuk
                  </p>
                  <MdCheckCircle className="text-sm text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-[#111418] dark:text-white">
                  {checkInTime || "--:--"}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1 font-medium">
                  {checkInTime ? "Tepat Waktu" : "Belum Absen"}
                </p>
              </div>
              <div
                className={`relative overflow-hidden p-4 rounded-xl border ${checkOutTime ? "bg-slate-50 dark:bg-[#1c2936] border-dashed border-slate-300 dark:border-gray-700" : "bg-slate-50 dark:bg-[#1c2936] border-dashed border-slate-300 dark:border-gray-700"}`}
              >
                <div className="absolute right-0 top-0 p-2 opacity-5 pointer-events-none">
                  <MdLogout className="text-5xl text-slate-500" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Jam Keluar
                  </p>
                  <MdPending className="text-sm text-slate-300 dark:text-gray-600" />
                </div>
                <p className="text-2xl font-bold text-slate-300 dark:text-gray-600">
                  {checkOutTime || "--:--"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {checkOutTime ? "Selesai" : "Belum Absen"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={
                  status === "idle" && !holidayInfo?.isNational
                    ? startCamera
                    : undefined
                }
                disabled={status !== "idle" || !!holidayInfo?.isNational}
                className={
                  status === "idle" && !holidayInfo?.isNational
                    ? "active:scale-95"
                    : "cursor-not-allowed"
                }
              >
                <MdFingerprint className="text-[20px]" />
                <span>Absen Masuk</span>
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={
                  status === "checked-in" && !holidayInfo?.isNational
                    ? startCamera
                    : undefined
                }
                disabled={status !== "checked-in" || !!holidayInfo?.isNational}
                className={`active:scale-95 ${status === "checked-in" && !holidayInfo?.isNational ? "" : "cursor-not-allowed"}`}
              >
                <MdLogout className="text-[20px]" />
                <span>Absen Keluar</span>
              </Button>
            </div>

            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-4 font-medium">
              Pastikan anda berada di area kantor sebelum absen.
            </p>
          </div>
        </div>

        {/* History Section */}
        <div className="mt-8 px-4 w-full max-w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111418] dark:text-white tracking-tight">
              {showAnalytics ? "Analisis Kehadiran" : "Riwayat Absensi"}
            </h3>
            <div className="flex gap-2">
              <Button
                variant={showAnalytics ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <MdAnalytics className="text-sm" />
                <span className="text-xs font-bold">
                  {showAnalytics ? "Riwayat" : "Analisis"}
                </span>
              </Button>
            </div>
          </div>

          {showAnalytics ? (
            <AttendanceAnalytics userId={user?.id} />
          ) : (
            <div className="space-y-3 pb-6">
              {history.map((record) => {
                const rec = record as Record<string, unknown>;
                const recDate = new Date(rec.checkIn as string);
                const recCheckIn = format(recDate, "HH:mm");
                const recCheckOut = rec.checkOut
                  ? format(new Date(rec.checkOut as string), "HH:mm")
                  : "--:--";

                let durationText = "Belum selesai";
                if (rec.checkOut) {
                  const diff =
                    new Date(rec.checkOut as string).getTime() -
                    recDate.getTime();
                  const hours = Math.floor(diff / 3600000);
                  durationText = `Total ${hours} jam kerja`;
                }

                return (
                  <div
                    key={rec.id as string}
                    className="flex items-center justify-between bg-white dark:bg-[#1c2936] p-3.5 rounded-xl border border-slate-100 dark:border-gray-800 shadow-sm transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center size-11 rounded-lg bg-slate-50 dark:bg-[#101922] text-[#111418] dark:text-white border border-slate-100 dark:border-gray-700">
                        <span className="text-[9px] uppercase font-bold text-slate-400">
                          {format(recDate, "EEE", { locale: id })}
                        </span>
                        <span className="text-base font-bold leading-none mt-0.5">
                          {format(recDate, "dd")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#111418] dark:text-white text-sm">
                            {recCheckIn}
                          </p>
                          <span className="text-slate-300 text-xs">•</span>
                          <p className="font-bold text-[#111418] dark:text-white text-sm">
                            {recCheckOut}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                          {durationText}
                        </p>
                        {rec.location && (
                          <div className="flex items-center gap-1 mt-1 text-slate-500 dark:text-gray-400">
                            <MdNearMe className="text-[10px]" />
                            <p className="text-[10px] line-clamp-1 max-w-[150px]">
                              {rec.location as string}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border ${
                        rec.status === "LATE"
                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                      }`}
                    >
                      {rec.status === "LATE" ? "Terlambat" : "Tepat Waktu"}
                    </span>
                  </div>
                );
              })}
              {history.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">
                  Belum ada riwayat absensi
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
