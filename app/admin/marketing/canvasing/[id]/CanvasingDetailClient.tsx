"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChevronLeft,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineClock,
  HiOutlineSignal,
  HiOutlineWifi,
  HiOutlineSquare3Stack3D,
  HiOutlineQrCode,
  HiOutlineGift,
  HiOutlineStar,
  HiOutlineCamera,
  HiOutlineDocumentText,
  HiOutlineUserCircle,
  HiOutlineCalendarDays,
  HiOutlineCheckBadge,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import axios from "axios";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import Image from "next/image";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";

interface PointClaim {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  buktiUrls: string[];
  keterangan?: string;
  pointValue: number;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: {
    name: string;
  };
  createdAt: string;
}

interface DetailActionModal {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: "approve" | "reject" | null;
}

interface CanvasingDetail {
  id: string;
  nama: string;
  noKtp: string;
  noTelpon: string;
  email?: string;
  alamat: string;
  kabel: number;
  odp?: string;
  paket: string;
  sn?: string;
  latitude?: number;
  longitude?: number;
  foto?: string;
  fotoKtp?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  sales?: {
    name: string;
    email: string;
  } | null;
  user?: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
  workOrder?: {
    workOrderNumber: string;
    status: string;
  };
  pointClaims?: PointClaim | null;
}

export default function CanvasingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { hasPermission, isSuperAdmin } = usePermission();
  const [item, setItem] = useState<CanvasingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [claimRejectNotes, setClaimRejectNotes] = useState("");
  const [claimRejectId, setClaimRejectId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<DetailActionModal>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "",
    action: null,
  });
  const canReviewCanvasing =
    isSuperAdmin ||
    hasPermission("canvasing:update") ||
    hasPermission("canvasing:verify");

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await axios.get(`/api/marketing/canvasing/${id}`);
        setItem(res.data?.data || res.data);
      } catch (error) {
        console.error("Fetch detail error:", error);
        const axiosError = error as {
          response?: { data?: { error?: string }; status?: number };
        };
        if (axiosError.response?.status === 404) {
          toast.error("Data canvasing tidak ditemukan");
        } else if (axiosError.response?.status === 403) {
          toast.error("Anda tidak memiliki akses untuk melihat data ini");
        } else {
          toast.error(
            axiosError.response?.data?.error || "Gagal memuat detail canvasing",
          );
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const refreshDetail = async () => {
    router.refresh();
    const res = await axios.get(`/api/marketing/canvasing/${id}`);
    setItem(res.data?.data || res.data);
  };

  const runStatusAction = async (action: "approve" | "reject") => {
    setIsProcessing(true);
    try {
      await axios.post(`/api/marketing/canvasing/${id}/${action}`);
      toast.success(
        action === "approve"
          ? "Request disetujui dan Work Order telah dibuat"
          : "Request ditolak",
      );
      await refreshDetail();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(
        axiosError.response?.data?.error || "Gagal memproses request",
      );
    } finally {
      setIsProcessing(false);
      closeActionModal();
    }
  };

  const closeActionModal = () => {
    setActionModal({
      open: false,
      title: "",
      message: "",
      confirmLabel: "",
      action: null,
    });
  };

  const handleApprove = () => {
    setActionModal({
      open: true,
      title: "Setujui Canvasing",
      message:
        "Setujui request ini? Sistem akan otomatis membuat Work Order instalasi.",
      confirmLabel: "Setujui",
      action: "approve",
    });
  };

  const handleReject = () => {
    setActionModal({
      open: true,
      title: "Tolak Canvasing",
      message: "Tolak request canvasing ini?",
      confirmLabel: "Tolak",
      action: "reject",
    });
  };

  const confirmStatusAction = async () => {
    if (actionModal.action) {
      await runStatusAction(actionModal.action);
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    setIsProcessing(true);
    try {
      await axios.put(`/api/marketing/point-claims/${claimId}`, {
        action: "approve",
      });
      toast.success("Claim poin berhasil disetujui");
      const res = await axios.get(`/api/marketing/canvasing/${id}`);
      setItem(res.data?.data || res.data);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || "Gagal menyetujui claim");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectClaim = (claimId: string) => {
    setClaimRejectId(claimId);
    setClaimRejectNotes("");
  };

  const closeClaimRejectModal = () => {
    setClaimRejectId(null);
    setClaimRejectNotes("");
  };

  const submitRejectClaim = async () => {
    if (!claimRejectId || !claimRejectNotes.trim()) {
      toast.error("Alasan penolakan harus diisi");
      return;
    }

    setIsProcessing(true);
    try {
      await axios.put(`/api/marketing/point-claims/${claimRejectId}`, {
        action: "reject",
        notes: claimRejectNotes.trim(),
      });
      toast.success("Claim poin ditolak");
      closeClaimRejectModal();
      await refreshDetail();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || "Gagal menolak claim");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-semibold">Data tidak ditemukan</p>
        <Button variant="link" onClick={() => router.back()} className="mt-4">
          ← Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2"
      >
        <HiOutlineChevronLeft className="w-5 h-5" />
        <span>Kembali ke Daftar</span>
      </Button>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Cover */}
            <div className="h-24 bg-indigo-600 dark:bg-indigo-700"></div>

            {/* Avatar & Name */}
            <div className="px-6 pb-6">
              <div className="-mt-12 mb-4">
                <div className="w-24 h-24 rounded-2xl bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {item.nama.charAt(0).toUpperCase()}
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {item.nama}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Calon Pelanggan
              </p>

              {/* Status Badge */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  item.status === "APPROVED"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : item.status === "REJECTED"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                }`}
              >
                {item.status === "APPROVED" && (
                  <HiOutlineCheck className="w-4 h-4" />
                )}
                {item.status === "REJECTED" && (
                  <HiOutlineXMark className="w-4 h-4" />
                )}
                {item.status === "PENDING" && (
                  <HiOutlineClock className="w-4 h-4" />
                )}
                {item.status}
              </div>
            </div>

            {/* Contact Info */}
            <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <HiOutlinePhone className="w-5 h-5 text-gray-400" />
                <a
                  href={`https://wa.me/${item.noTelpon}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {item.noTelpon}
                </a>
              </div>
              {item.email && (
                <div className="flex items-center gap-3 text-sm">
                  <HiOutlineEnvelope className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {item.email}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <HiOutlineMapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300">
                  {item.alamat}
                </span>
              </div>
            </div>

            {/* NIK */}
            <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                NIK KTP
              </p>
              <p className="font-mono text-sm text-gray-800 dark:text-gray-200">
                {item.noKtp}
              </p>
            </div>
          </div>

          {/* Sales Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Sales
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold">
                {(item.user?.name || item.sales?.name)
                  ?.charAt(0)
                  .toUpperCase() || "-"}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {item.user?.name || item.sales?.name || "-"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.user?.email || item.sales?.email || "-"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              Diajukan{" "}
              {format(new Date(item.createdAt), "dd MMMM yyyy, HH:mm", {
                locale: idLocale,
              })}
            </p>
          </div>

          {/* Map Link */}
          {item.latitude && item.longitude && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Lokasi GPS
                  </h3>
                  <p className="font-mono text-sm text-gray-800 dark:text-gray-200">
                    {item.latitude}, {item.longitude}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <HiOutlineMapPin className="w-5 h-5" />
                </div>
              </div>
            </a>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Technical Specs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              Spesifikasi Layanan
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                <HiOutlineWifi className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                  Paket
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {item.paket}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                <HiOutlineSquare3Stack3D className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                  Kabel
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {item.kabel}m
                </p>
              </div>

              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-100 dark:border-pink-800">
                <HiOutlineSignal className="w-6 h-6 text-pink-600 dark:text-pink-400 mb-2" />
                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium mb-1">
                  ODP
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {item.odp || "-"}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                <HiOutlineQrCode className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-2" />
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                  SN
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-white font-mono truncate">
                  {item.sn || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              Dokumentasi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* KTP */}
              <div
                className={`aspect-video rounded-xl overflow-hidden border-2 ${
                  item.fotoKtp
                    ? "cursor-zoom-in hover:border-indigo-400 dark:hover:border-indigo-500"
                    : "border-dashed"
                } border-gray-200 dark:border-gray-700 transition-colors`}
                onClick={() => item.fotoKtp && setZoomImage(item.fotoKtp)}
              >
                {item.fotoKtp ? (
                  <div className="relative w-full h-full group">
                    <Image
                      src={item.fotoKtp}
                      alt="Foto KTP"
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-black/50" />
                    <span className="absolute bottom-3 left-3 text-white text-sm font-medium">
                      Foto KTP
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <span className="text-sm">Foto KTP</span>
                    <span className="text-xs mt-1">Tidak tersedia</span>
                  </div>
                )}
              </div>

              {/* Location */}
              <div
                className={`aspect-video rounded-xl overflow-hidden border-2 ${
                  item.foto
                    ? "cursor-zoom-in hover:border-indigo-400 dark:hover:border-indigo-500"
                    : "border-dashed"
                } border-gray-200 dark:border-gray-700 transition-colors`}
                onClick={() => item.foto && setZoomImage(item.foto)}
              >
                {item.foto ? (
                  <div className="relative w-full h-full group">
                    <Image
                      src={item.foto}
                      alt="Foto Lokasi"
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-black/50" />
                    <span className="absolute bottom-3 left-3 text-white text-sm font-medium">
                      Foto Lokasi
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <span className="text-sm">Foto Lokasi</span>
                    <span className="text-xs mt-1">Tidak tersedia</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Work Order Badge */}
          {item.workOrder && (
            <div className="bg-green-600 dark:bg-green-700 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm mb-1">
                    Work Order Dibuat
                  </p>
                  <p className="text-2xl font-bold font-mono">
                    {item.workOrder.workOrderNumber}
                  </p>
                  {item.workOrder.status && (
                    <p className="text-green-200 text-xs mt-1">
                      Status: {item.workOrder.status}
                    </p>
                  )}
                </div>
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <HiOutlineCheck className="w-8 h-8" />
                </div>
              </div>
            </div>
          )}

          {/* Point Claim Section */}
          {item.pointClaims &&
            (() => {
              const claim = item.pointClaims;
              const statusConfig = {
                APPROVED: {
                  bg: "bg-emerald-50 dark:bg-emerald-950/40",
                  border: "border-emerald-200 dark:border-emerald-800",
                  accent: "text-emerald-600 dark:text-emerald-400",
                  accentBg: "bg-emerald-100 dark:bg-emerald-900/40",
                  badge: "bg-emerald-600 text-white",
                  label: "Disetujui",
                  icon: <HiOutlineCheckBadge className="w-5 h-5" />,
                },
                REJECTED: {
                  bg: "bg-red-50 dark:bg-red-950/40",
                  border: "border-red-200 dark:border-red-800",
                  accent: "text-red-600 dark:text-red-400",
                  accentBg: "bg-red-100 dark:bg-red-900/40",
                  badge: "bg-red-600 text-white",
                  label: "Ditolak",
                  icon: <HiOutlineExclamationTriangle className="w-5 h-5" />,
                },
                PENDING: {
                  bg: "bg-amber-50 dark:bg-amber-950/40",
                  border: "border-amber-200 dark:border-amber-800",
                  accent: "text-amber-600 dark:text-amber-400",
                  accentBg: "bg-amber-100 dark:bg-amber-900/40",
                  badge: "bg-amber-500 text-white",
                  label: "Menunggu Review",
                  icon: <HiOutlineClock className="w-5 h-5" />,
                },
              };
              const cfg = statusConfig[claim.status];

              return (
                <div
                  className={`rounded-2xl shadow-sm border ${cfg.border} overflow-hidden`}
                >
                  {/* Claim Header */}
                  <div className={`${cfg.bg} px-6 py-5`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl ${cfg.accentBg} flex items-center justify-center ${cfg.accent}`}
                        >
                          <HiOutlineGift className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Claim Poin
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Diajukan{" "}
                            {format(
                              new Date(claim.createdAt),
                              "dd MMMM yyyy, HH:mm",
                              { locale: idLocale },
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
                          <HiOutlineStar className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            +{claim.pointValue} Poin
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${cfg.badge}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 px-6 py-5 space-y-5">
                    {/* Keterangan */}
                    {claim.keterangan && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <HiOutlineDocumentText className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Keterangan Sales
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {claim.keterangan}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bukti Photos */}
                    {claim.buktiUrls && claim.buktiUrls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <HiOutlineCamera className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Bukti Foto ({claim.buktiUrls.length})
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {claim.buktiUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-zoom-in hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
                              onClick={() => setZoomImage(url)}
                            >
                              <Image
                                src={url}
                                alt={`Bukti ${idx + 1}`}
                                fill
                                sizes="(max-width: 768px) 50vw, 200px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                              <span className="absolute bottom-1.5 left-2 text-white text-xs font-medium">
                                Bukti {idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Info */}
                    {(claim.status === "APPROVED" ||
                      claim.status === "REJECTED") && (
                      <div
                        className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          {cfg.icon}
                          <p
                            className={`text-xs font-semibold uppercase tracking-wider ${cfg.accent}`}
                          >
                            Hasil Review
                          </p>
                        </div>
                        <div className="space-y-2">
                          {claim.reviewedBy && (
                            <div className="flex items-center gap-2 text-sm">
                              <HiOutlineUserCircle className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-gray-500 dark:text-gray-400">
                                Direview oleh:
                              </span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                {claim.reviewedBy.name}
                              </span>
                            </div>
                          )}
                          {claim.reviewedAt && (
                            <div className="flex items-center gap-2 text-sm">
                              <HiOutlineCalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-gray-500 dark:text-gray-400">
                                Tanggal:
                              </span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                {format(
                                  new Date(claim.reviewedAt),
                                  "dd MMMM yyyy, HH:mm",
                                  { locale: idLocale },
                                )}
                              </span>
                            </div>
                          )}
                          {claim.reviewNotes && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                Catatan Review:
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {claim.reviewNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons for PENDING */}
                    {claim.status === "PENDING" && canReviewCanvasing && (
                      <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => handleApproveClaim(claim.id)}
                          disabled={isProcessing}
                          className="flex-1 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                          <HiOutlineCheck className="w-4 h-4" />
                          Setujui Claim
                        </button>
                        <button
                          onClick={() => handleRejectClaim(claim.id)}
                          disabled={isProcessing}
                          className="py-2.5 px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          <HiOutlineXMark className="w-4 h-4" />
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Action Buttons */}
          {item.status === "PENDING" && canReviewCanvasing && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Tindakan
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Dengan menyetujui, sistem akan otomatis membuat Work Order
                instalasi.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <HiOutlineCheck className="w-5 h-5" />
                  Setujui
                </button>
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <HiOutlineXMark className="w-5 h-5" />
                  Tolak
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={actionModal.open}
        onClose={closeActionModal}
        title={actionModal.title}
        size="md"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {actionModal.message}
        </p>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={closeActionModal}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button onClick={confirmStatusAction} disabled={isProcessing}>
            {actionModal.confirmLabel}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={!!claimRejectId}
        onClose={closeClaimRejectModal}
        title="Tolak Claim Poin"
        size="md"
      >
        <textarea
          aria-label="Alasan penolakan claim"
          value={claimRejectNotes}
          onChange={(event) => setClaimRejectNotes(event.target.value)}
          className="min-h-28 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          placeholder="Tuliskan alasan penolakan claim"
        />
        <ModalFooter>
          <Button
            variant="outline"
            onClick={closeClaimRejectModal}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button onClick={submitRejectClaim} disabled={isProcessing}>
            Kirim Penolakan
          </Button>
        </ModalFooter>
      </Modal>

      {/* Zoom Modal */}
      <Modal
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        padding={false}
        size="4xl"
        showCloseButton={true}
        title="Preview Foto"
      >
        <div className="relative w-full h-[80vh] flex items-center justify-center bg-black/90">
          {zoomImage && (
            <Image
              src={zoomImage}
              alt="Zoomed"
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-contain"
            />
          )}
        </div>
        <ModalFooter className="bg-black/90 border-t border-white/10">
          <Button variant="ghost" onClick={() => setZoomImage(null)}>
            Tutup
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
