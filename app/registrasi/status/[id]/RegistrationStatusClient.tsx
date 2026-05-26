"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineWrenchScrewdriver,
  HiOutlineSignal,
  HiOutlineHome,
} from "react-icons/hi2";

type Status =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SURVEYED"
  | "INSTALLED"
  | "CANCELLED";

interface RegistrationStatusData {
  id: string;
  name: string;
  packageName: string | null;
  status: Status;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
}

interface ApiResponse {
  data?: RegistrationStatusData;
  error?: string;
}

const STAGES: { status: Status; label: string; icon: React.ReactNode }[] = [
  {
    status: "PENDING",
    label: "Menunggu Verifikasi",
    icon: <HiOutlineClock className="w-5 h-5" />,
  },
  {
    status: "VERIFIED",
    label: "Diverifikasi",
    icon: <HiOutlineCheckCircle className="w-5 h-5" />,
  },
  {
    status: "SURVEYED",
    label: "Survei Lokasi",
    icon: <HiOutlineWrenchScrewdriver className="w-5 h-5" />,
  },
  {
    status: "INSTALLED",
    label: "Terpasang",
    icon: <HiOutlineSignal className="w-5 h-5" />,
  },
];

const STATUS_INDEX: Record<Status, number> = {
  PENDING: 0,
  VERIFIED: 1,
  SURVEYED: 2,
  INSTALLED: 3,
  REJECTED: -1,
  CANCELLED: -1,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RegistrationStatusClient({
  registrationId,
}: {
  registrationId: string;
}) {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<RegistrationStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim()) {
      setError("Masukkan nomor telepon yang dipakai saat mendaftar");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/public/registration-status/${registrationId}?phone=${encodeURIComponent(phone)}`,
      );
      const body: ApiResponse = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setError(
            "Pendaftaran tidak ditemukan. Periksa kembali nomor telepon Anda.",
          );
        } else {
          setError(body.error || "Gagal memuat status");
        }
        setData(null);
      } else if (body.data) {
        setData(body.data);
        setSubmitted(true);
      }
    } catch {
      setError("Tidak dapat terhubung. Coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data) {
      const interval = setInterval(() => {
        if (phone) void handleLookup();
      }, 60_000);
      return () => clearInterval(interval);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, phone]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Status Pendaftaran
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Cek progress pendaftaran layanan internet Anda.
          </p>
        </header>

        {!submitted || !data ? (
          <form
            onSubmit={handleLookup}
            className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nomor Telepon yang dipakai saat mendaftar{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Untuk memastikan kerahasiaan data, masukkan nomor telepon yang
                Anda daftarkan.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {loading ? "Memuat..." : "Cek Status"}
            </button>
          </form>
        ) : (
          <StatusDisplay data={data} />
        )}

        <footer className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <HiOutlineHome className="w-4 h-4" />
            Kembali ke beranda
          </Link>
        </footer>
      </div>
    </div>
  );
}

function StatusDisplay({ data }: { data: RegistrationStatusData }) {
  const isRejected = data.status === "REJECTED" || data.status === "CANCELLED";
  const currentIndex = STATUS_INDEX[data.status];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Atas nama
            </p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {data.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tanggal Daftar
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {formatDateTime(data.createdAt)}
            </p>
          </div>
        </div>

        {data.packageName && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Paket: <span className="font-semibold">{data.packageName}</span>
          </div>
        )}
      </div>

      {isRejected ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <HiOutlineXCircle className="w-8 h-8 text-red-600 shrink-0" />
            <div>
              <h2 className="font-semibold text-red-900 dark:text-red-200">
                Pendaftaran{" "}
                {data.status === "REJECTED" ? "Ditolak" : "Dibatalkan"}
              </h2>
              {data.rejectionReason && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Alasan: {data.rejectionReason}
                </p>
              )}
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Diperbarui {formatDateTime(data.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Progress Pendaftaran
          </h2>

          <ol className="space-y-4">
            {STAGES.map((stage, idx) => {
              const isDone = idx <= currentIndex;
              const isCurrent = idx === currentIndex;

              return (
                <li key={stage.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      }`}
                    >
                      {stage.icon}
                    </div>
                    {idx < STAGES.length - 1 && (
                      <div
                        className={`w-0.5 h-10 ${
                          idx < currentIndex
                            ? "bg-emerald-500"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p
                      className={`font-medium ${
                        isDone
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500"
                      }`}
                    >
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                        Sedang berlangsung...
                      </p>
                    )}
                    {isDone &&
                      stage.status === "VERIFIED" &&
                      data.verifiedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateTime(data.verifiedAt)}
                        </p>
                      )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
            Halaman ini diperbarui otomatis setiap menit. Update terakhir{" "}
            {formatDateTime(data.updatedAt)}.
          </div>
        </div>
      )}
    </div>
  );
}
