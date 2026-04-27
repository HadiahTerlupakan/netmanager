"use client";

import React, { useEffect, useState, use, useCallback } from "react";
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
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");

  const fetchIpInfo = useCallback(async (ip: string) => {
    try {
      const res = await fetch(`/api/ip-info?ip=${encodeURIComponent(ip)}`);
      if (res.ok) {
        setIpInfo(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch IP info", e);
    }
  }, []);

  const fetchRegistration = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/registrations/${resolvedParams.id}`);
      if (res.ok) {
        const response = await res.json();
        const registrationData = response.data;
        setRegistration(registrationData);
        if (registrationData?.ipAddress) {
          fetchIpInfo(registrationData.ipAddress);
        }
      } else {
        setError("Pendaftaran tidak ditemukan");
      }
    } catch (e) {
      setError("Gagal memuat data");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedParams.id, fetchIpInfo]);

  useEffect(() => {
    fetchRegistration();
  }, [fetchRegistration]);

  const updateStatus = async (newStatus: string, reason?: string) => {
    setIsSaving(true);
    setError("");
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
        setRegistration(data.data);
        setShowRejectModal(false);
        setRejectionReason("");
      } else {
        setError(data.error || "Gagal mengubah status");
      }
    } catch (e) {
      setError("Terjadi kesalahan");
      console.error(e);
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

  const getAvailableActions = (status: string) => {
    switch (status) {
      case "PENDING":
        return [
          {
            label: "Verifikasi",
            status: "VERIFIED",
            color: "bg-blue-600 hover:bg-blue-700",
            icon: MdCheckCircle,
          },
          {
            label: "Tolak",
            status: "REJECTED",
            color: "bg-red-600 hover:bg-red-700",
            icon: MdBlock,
            needsReason: true,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            color: "bg-gray-600 hover:bg-gray-700",
            icon: MdCancel,
          },
        ];
      case "VERIFIED":
        return [
          {
            label: "Tandai Sudah Survei",
            status: "SURVEYED",
            color: "bg-purple-600 hover:bg-purple-700",
            icon: MdConstruction,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            color: "bg-gray-600 hover:bg-gray-700",
            icon: MdCancel,
          },
        ];
      case "SURVEYED":
        return [
          {
            label: "Tandai Terinstal",
            status: "INSTALLED",
            color: "bg-green-600 hover:bg-green-700",
            icon: MdInstallDesktop,
          },
          {
            label: "Batalkan",
            status: "CANCELLED",
            color: "bg-gray-600 hover:bg-gray-700",
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
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
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
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">
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
                      onClick={() => {
                        if (action.needsReason) {
                          setShowRejectModal(true);
                        } else {
                          updateStatus(action.status);
                        }
                      }}
                      disabled={isSaving}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg transition-colors disabled:opacity-50 ${action.color}`}
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
            onClick={() => {
              setShowRejectModal(false);
              setRejectionReason("");
            }}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Batal
          </Button>
          <Button
            onClick={() => updateStatus("REJECTED", rejectionReason)}
            disabled={isSaving || !rejectionReason.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Menyimpan..." : "Tolak"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
