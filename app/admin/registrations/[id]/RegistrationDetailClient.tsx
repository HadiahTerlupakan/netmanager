"use client";
import { clientLogger } from "@/lib/client-logger";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  MdArrowBack,
  MdCheckCircle,
  MdCancel,
  MdBlock,
  MdPerson,
  MdEmail,
  MdPhone,
  MdLocationOn,
  MdHome,
  MdWifi,
  MdAccessTime,
  MdPublic,
  MdNotes,
  MdVerified,
  MdConstruction,
  MdInstallDesktop,
} from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";

interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string | null;
  packageName: string | null;
  ipAddress: string | null;
  status:
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "SURVEYED"
    | "INSTALLED"
    | "CANCELLED";
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IpInfo {
  ip: string;
  country: string;
  isp: string;
}

export function ClientComponent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [isSaving, setIsSaving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const {
    data: registration,
    isLoading,
    error: fetchError,
    mutate: refetchRegistration,
  } = useApi<Registration>(`/api/admin/registrations/${resolvedParams.id}`);

  const ipAddress = registration?.ipAddress ?? null;
  const { data: ipInfo, error: ipError } = useApi<IpInfo>(
    ipAddress ? `/api/ip-info?ip=${encodeURIComponent(ipAddress)}` : null,
  );

  const [actionError, setActionError] = useState("");

  const error = actionError
    ? actionError
    : fetchError
      ? fetchError.status === 404
        ? "Pendaftaran tidak ditemukan"
        : fetchError.message || "Gagal memuat data"
      : "";

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Gagal memuat detail pendaftaran", fetchError);
    }
  }, [fetchError]);

  useEffect(() => {
    if (ipError) {
      clientLogger.error("Failed to fetch IP info", ipError);
    }
  }, [ipError]);

  const updateStatus = async (newStatus: string, reason?: string) => {
    setIsSaving(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/registrations/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          rejectionReason: reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        void refetchRegistration(data.data, { revalidate: false });
        setShowRejectModal(false);
        setRejectionReason("");
      } else {
        setActionError(data.error || "Gagal mengubah status");
      }
    } catch (e) {
      setActionError("Terjadi kesalahan");
      clientLogger.error("Gagal mengubah status pendaftaran", e);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-300",
          icon: MdAccessTime,
          label: "Menunggu Verifikasi",
        };
      case "VERIFIED":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-300",
          icon: MdVerified,
          label: "Terverifikasi",
        };
      case "REJECTED":
        return {
          color: "bg-red-100 text-red-800 border-red-300",
          icon: MdBlock,
          label: "Ditolak",
        };
      case "SURVEYED":
        return {
          color: "bg-purple-100 text-purple-800 border-purple-300",
          icon: MdConstruction,
          label: "Sudah Disurvei",
        };
      case "INSTALLED":
        return {
          color: "bg-green-100 text-green-800 border-green-300",
          icon: MdInstallDesktop,
          label: "Terinstal",
        };
      case "CANCELLED":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: MdCancel,
          label: "Dibatalkan",
        };
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: MdAccessTime,
          label: status,
        };
    }
  };

  type RegistrationAction = {
    label: string;
    status: string;
    variant: "default" | "destructive" | "secondary" | "success";
    icon: typeof MdCheckCircle;
    needsReason?: boolean;
  };

  const getAvailableActions = (status: string): RegistrationAction[] => {
    switch (status) {
      case "PENDING":
        return [
          {
            label: "Verifikasi",
            status: "VERIFIED",
            variant: "default" as const,
            icon: MdCheckCircle,
          },
          {
            label: "Tolak",
            status: "REJECTED",
            variant: "destructive" as const,
            icon: MdBlock,
            needsReason: true,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            variant: "secondary" as const,
            icon: MdCancel,
          },
        ];
      case "VERIFIED":
        return [
          {
            label: "Tandai Sudah Survei",
            status: "SURVEYED",
            variant: "default" as const,
            icon: MdConstruction,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            variant: "secondary" as const,
            icon: MdCancel,
          },
        ];
      case "SURVEYED":
        return [
          {
            label: "Tandai Terinstal",
            status: "INSTALLED",
            variant: "success" as const,
            icon: MdInstallDesktop,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            variant: "secondary" as const,
            icon: MdCancel,
          },
        ];
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error && !registration) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
        <Link
          href="/admin/registrations"
          className="mt-4 inline-flex items-center text-blue-600 hover:underline"
        >
          <MdArrowBack className="mr-1" /> Kembali
        </Link>
      </div>
    );
  }

  if (!registration) return null;

  const statusConfig = getStatusConfig(registration.status);
  const StatusIcon = statusConfig.icon;
  const actions = getAvailableActions(registration.status);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/registrations"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <MdArrowBack className="text-xl text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Detail Pendaftaran
            </h1>
            <p className="text-sm text-slate-500">ID: {registration.id}</p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full border ${statusConfig.color}`}
        >
          <StatusIcon className="text-lg" />
          <span className="font-semibold">{statusConfig.label}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Informasi Pelanggan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MdPerson className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Nama</p>
                  <p className="font-medium text-slate-800">
                    {registration.name}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MdPhone className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Telepon</p>
                  <p className="font-medium text-slate-800">
                    {registration.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MdEmail className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-slate-800">
                    {registration.email}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MdWifi className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Paket</p>
                  <p className="font-medium text-slate-800">
                    {registration.packageName || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Location Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Lokasi
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MdLocationOn className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Area</p>
                  <p className="font-medium text-slate-800">
                    {registration.location || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MdHome className="text-xl text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Alamat Lengkap</p>
                  <p className="font-medium text-slate-800">
                    {registration.address}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          {registration.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <MdNotes className="text-slate-400" /> Catatan
              </h2>
              <p className="text-slate-700">{registration.notes}</p>
            </div>
          )}

          {/* Rejection Reason */}
          {registration.status === "REJECTED" &&
            registration.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <MdBlock /> Alasan Penolakan
                </h2>
                <p className="text-red-700">{registration.rejectionReason}</p>
              </div>
            )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions Card */}
          {actions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Aksi
              </h2>
              <div className="space-y-3">
                {actions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Button
                      key={action.status}
                      variant={action.variant}
                      onClick={() => {
                        if (action.needsReason) {
                          setShowRejectModal(true);
                        } else {
                          updateStatus(action.status);
                        }
                      }}
                      disabled={isSaving}
                      className="w-full"
                    >
                      <ActionIcon className="text-lg" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Info Teknis
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-500">Tanggal Daftar</p>
                <p className="font-medium text-slate-800">
                  {new Date(registration.createdAt).toLocaleString("id-ID")}
                </p>
              </div>
              {registration.verifiedAt && (
                <div>
                  <p className="text-slate-500">Diverifikasi</p>
                  <p className="font-medium text-slate-800">
                    {new Date(registration.verifiedAt).toLocaleString("id-ID")}
                    {registration.verifiedBy &&
                      ` oleh ${registration.verifiedBy}`}
                  </p>
                </div>
              )}
              <div>
                <p className="text-slate-500 flex items-center gap-1">
                  <MdPublic /> IP Address
                </p>
                <p className="font-mono text-slate-800">
                  {registration.ipAddress || "-"}
                </p>
                {ipInfo && (
                  <p className="text-slate-500 text-xs mt-1">
                    {ipInfo.country} • {ipInfo.isp}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason("");
        }}
        title="Tolak Pendaftaran"
        description="Masukkan alasan penolakan untuk pendaftaran ini."
        size="md"
      >
        <div>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Contoh: Data tidak valid, nomor telepon tidak dapat dihubungi..."
            className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowRejectModal(false);
              setRejectionReason("");
            }}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => updateStatus("REJECTED", rejectionReason)}
            disabled={isSaving || !rejectionReason.trim()}
            className="flex-1"
          >
            {isSaving ? "Menyimpan..." : "Tolak"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
