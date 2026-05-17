"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  FaCamera,
  FaCheck,
  FaSignOutAlt,
  FaMapMarkerAlt,
  FaSpinner,
} from "react-icons/fa";
import { AttendanceStatusIndicator } from "./AttendanceStatusIndicator";
import { GeofenceStatusBadge } from "./GeofenceStatusBadge";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";

interface AttendanceUser {
  workingHourMode?: "FIXED" | "SHIFT" | "FLEXIBLE";
  flexibleTargetHour?: number;
}

interface AttendanceRecord {
  checkIn: string;
  checkOut?: string;
  status?: "ON_TIME" | "LATE";
  user?: AttendanceUser;
}

export default function AttendanceCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "checked-in" | "checked-out">(
    "idle",
  );
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<"ON_TIME" | "LATE">(
    "ON_TIME",
  );
  const [workingHourMode, setWorkingHourMode] = useState<
    "FIXED" | "SHIFT" | "FLEXIBLE"
  >("FIXED");
  const [targetHours, setTargetHours] = useState(8);

  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const geofenceStatus: "INSIDE" | "OUTSIDE" | "UNKNOWN" = "UNKNOWN";
  const geofenceDistance: number | null = null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    data: history,
    isLoading: checkingStatus,
    error: historyError,
    mutate: refetchStatus,
  } = useApi<AttendanceRecord[]>("/api/attendance/history?limit=1");

  useEffect(() => {
    if (historyError) {
      clientLogger.error("Failed to fetch attendance status", historyError);
      toast.error("Gagal memuat status absensi");
    }
  }, [historyError]);

  const [hasHydrated, setHasHydrated] = useState(false);
  if (history !== undefined && !hasHydrated) {
    setHasHydrated(true);
    if (history.length > 0) {
      const lastAttendance = history[0];
      if (lastAttendance) {
        const today = new Date().toDateString();
        const attendanceDate = new Date(lastAttendance.checkIn).toDateString();
        if (today === attendanceDate) {
          setCheckInTime(new Date(lastAttendance.checkIn).toLocaleTimeString());
          setCheckInDate(new Date(lastAttendance.checkIn));
          setAttendanceStatus(lastAttendance.status || "ON_TIME");
          if (lastAttendance.user) {
            setWorkingHourMode(lastAttendance.user.workingHourMode || "FIXED");
            setTargetHours(lastAttendance.user.flexibleTargetHour || 8);
          }
          if (lastAttendance.checkOut) {
            setStatus("checked-out");
            setCheckOutTime(
              new Date(lastAttendance.checkOut).toLocaleTimeString(),
            );
            setCheckOutDate(new Date(lastAttendance.checkOut));
          } else {
            setStatus("checked-in");
          }
        } else {
          setStatus("idle");
        }
      }
    } else {
      setStatus("idle");
    }
  }

  const fetchStatus = () => refetchStatus();

  const startCamera = async () => {
    setShowCamera(true);
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      clientLogger.error("Error accessing camera", err);
      toast.error("Gagal mengakses kamera. Pastikan izin diberikan.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        // Set canvas dimensions to match video
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;

        // Draw video frame to canvas
        context.drawImage(
          videoRef.current,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height,
        );

        // Convert to base64
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(
            `${position.coords.latitude},${position.coords.longitude}`,
          );
          toast.success("Lokasi berhasil didapatkan");
        },
        (error) => {
          clientLogger.error("Error getting location", error);
          toast.error("Gagal mendapatkan lokasi");
        },
      );
    } else {
      toast.error("Browser tidak mendukung geolocation");
    }
  };

  const handleSubmit = async () => {
    if (!photo) {
      toast.error("Foto selfie wajib diambil");
      return;
    }

    setLoading(true);

    try {
      // Convert base64 to file
      const res = await fetch(photo);
      const blob = await res.blob();
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("photo", file);
      if (notes) formData.append("notes", notes);
      if (location) formData.append("location", location);

      const endpoint =
        status === "idle"
          ? "/api/attendance/check-in"
          : "/api/attendance/check-out";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Terjadi kesalahan");
      }

      toast.success(
        status === "idle" ? "Check-in berhasil!" : "Check-out berhasil!",
      );
      setPhoto(null);
      setNotes("");
      await fetchStatus();

      // Delay agar user dapat melihat pesan sukses
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse h-64 flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <FaCheck className="text-green-500" /> Absensi Harian
      </h2>

      <div className="flex flex-col gap-4">
        {/* Status Display */}
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
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jam Masuk
              </p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {checkInTime || "-"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jam Keluar
              </p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {checkOutTime || "-"}
              </p>
            </div>
          </div>
        )}

        {/* Geofence Status */}
        <GeofenceStatusBadge
          status={geofenceStatus}
          distance={geofenceDistance}
          siteName={null}
        />

        {/* Action Area */}
        {status !== "checked-out" && (
          <div className="space-y-4 border-t pt-4 dark:border-gray-700">
            {/* Camera Preview */}
            {showCamera && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="secondary"
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2"
                >
                  <div className="w-4 h-4 bg-red-500 dark:bg-red-400 rounded-full"></div>
                </Button>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Photo Preview */}
            {photo && !showCamera && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <Image
                  src={photo}
                  alt="Selfie Preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 rounded-full"
                >
                  Ulang
                </Button>
              </div>
            )}

            {/* Controls */}
            {!showCamera && !photo && (
              <Button onClick={startCamera} className="w-full">
                <FaCamera /> Ambil Foto Selfie
              </Button>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={getLocation}
                className="flex-1"
              >
                <FaMapMarkerAlt />{" "}
                {location ? "Lokasi Tersimpan" : "Ambil Lokasi"}
              </Button>
            </div>

            <textarea
              placeholder="Catatan (opsional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows={2}
            />

            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={loading || !photo}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <FaSpinner className="animate-spin" /> Memproses...
                </span>
              ) : status === "idle" ? (
                "Check In"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <FaSignOutAlt /> Check Out
                </span>
              )}
            </Button>

            {!photo && (
              <p className="text-xs text-center text-red-500">
                * Foto selfie wajib diisi
              </p>
            )}
          </div>
        )}

        {status === "checked-out" && (
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
            <FaCheck className="mx-auto text-2xl mb-2" />
            <p className="font-medium">Absensi hari ini selesai</p>
          </div>
        )}
      </div>
    </div>
  );
}
