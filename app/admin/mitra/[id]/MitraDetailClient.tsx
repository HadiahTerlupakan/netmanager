"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HiOutlineArrowLeft,
  HiOutlineWrenchScrewdriver,
  HiOutlineMegaphone,
  HiOutlineBanknotes,
  HiOutlineWallet,
  HiOutlineShieldCheck,
  HiOutlineIdentification,
  HiOutlinePencilSquare,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineCamera,
  HiOutlineDocumentText,
} from "react-icons/hi2";

// ─── Types ───────────────────────────────────────────────────────────

interface MitraDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  mitraType: "MITRA_TEKNISI" | "MITRA_SALES";
  isActive: boolean;
  siteId: string | null;
  mitraRateWoPsb: number | null;
  mitraRateWoMaintenance: number | null;
  mitraRateCanvasing: number | null;
  minWithdrawal: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  targetHarian: number | null;
  garansiHari: number | null;
  slaGaransiJam: number | null;
  penaltyPsb: number | null;
  penaltyMaintenance: number | null;
  nik: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  latitudeRumah: number | null;
  longitudeRumah: number | null;
  fotoDiri: string | null;
  fotoKtp: string | null;
  fotoSim: string | null;
  fotoKk: string | null;
  requiresFaceVerification: boolean;
  lastFaceVerification: string | null;
  sites: { id: string; name: string } | null;
  mitraWallet: {
    id: string;
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
  } | null;
  faceVerificationLogs: FaceVerificationLog[];
  createdAt: string;
}

interface FaceVerificationLog {
  id: string;
  photoUrl: string;
  latitude: number | null;
  longitude: number | null;
  deviceInfo: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const fmt = (amount: number | null | undefined) => {
  if (amount === undefined || amount === null) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Component ───────────────────────────────────────────────────────

export default function MitraDetailClient() {
  const params = useParams();
  const router = useRouter();
  const [mitra, setMitra] = useState<MitraDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [faceLogs, setFaceLogs] = useState<FaceVerificationLog[]>([]);
  const [faceLogsPage, setFaceLogsPage] = useState(1);
  const [faceLogsTotalPages, setFaceLogsTotalPages] = useState(1);
  const [faceLogsTotal, setFaceLogsTotal] = useState(0);
  const [faceLogsLoading, setFaceLogsLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchMitra = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/mitra/${params.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setMitra(data.data);
        if (data.data.faceVerificationLogs) {
          setFaceLogs(data.data.faceVerificationLogs);
        }
      } else {
        toast.error(data.error || "Gagal memuat data mitra");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchFaceLogs = useCallback(
    async (page: number) => {
      try {
        setFaceLogsLoading(true);
        const res = await fetch(
          `/api/admin/mitra/${params.id}/face-verifications?page=${page}&limit=10`,
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setFaceLogs(data.data.logs);
          setFaceLogsTotalPages(data.data.totalPages);
          setFaceLogsTotal(data.data.total);
          setFaceLogsPage(data.data.page);
        }
      } catch {
        toast.error("Gagal memuat history verifikasi");
      } finally {
        setFaceLogsLoading(false);
      }
    },
    [params.id],
  );

  // Pattern C: fetch mitra detail saat params.id berubah
  const paramsId = params.id as string | string[] | undefined;
  const paramsIdKey = Array.isArray(paramsId)
    ? paramsId.join(",")
    : (paramsId ?? "");
  const [prevParamsIdKey, setPrevParamsIdKey] = useState<string | null>(null);
  if (prevParamsIdKey !== paramsIdKey) {
    setPrevParamsIdKey(paramsIdKey);
    if (paramsIdKey) {
      void fetchMitra();
    }
  }

  const handleRequestFaceVerification = async () => {
    if (!mitra) return;
    if (
      !confirm(
        "Apakah Anda yakin ingin mewajibkan mitra ini untuk verifikasi wajah?",
      )
    )
      return;
    const tid = toast.loading("Memicu verifikasi wajah...");
    try {
      const res = await fetch(`/api/admin/mitra/${mitra.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresFaceVerification: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Mitra diwajibkan verifikasi wajah", { id: tid });
        fetchMitra();
      } else {
        toast.error(data.error || "Gagal", { id: tid });
      }
    } catch {
      toast.error("Terjadi kesalahan", { id: tid });
    }
  };

  // ─── Loading / Error States ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 animate-pulse">Memuat detail mitra...</p>
      </div>
    );
  }

  if (!mitra) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Data mitra tidak ditemukan</p>
        <button
          onClick={() => router.back()}
          className="text-indigo-600 mt-4 hover:underline"
        >
          Kembali
        </button>
      </div>
    );
  }

  const isTeknisi = mitra.mitraType === "MITRA_TEKNISI";

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Back + Title ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/mitra")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Detail Mitra
            </h1>
            <p className="text-xs text-gray-400">
              Informasi lengkap dan riwayat verifikasi
            </p>
          </div>
        </div>
        {/* Quick Actions */}
        <div className="flex gap-2">
          <ActionBtn
            icon={<HiOutlinePencilSquare className="w-4 h-4" />}
            label="Edit"
            color="indigo"
            onClick={() => router.push(`/admin/mitra?edit=${mitra.id}`)}
          />
          <ActionBtn
            icon={<HiOutlineCamera className="w-4 h-4" />}
            label="Verif Wajah"
            color={mitra.requiresFaceVerification ? "gray" : "blue"}
            onClick={handleRequestFaceVerification}
            disabled={mitra.requiresFaceVerification}
          />
          <ActionBtn
            icon={<HiOutlineIdentification className="w-4 h-4" />}
            label="ID Card"
            color="purple"
            onClick={() => window.open(`/mitra-id/${mitra.id}`, "_blank")}
          />
        </div>
      </div>

      {/* ── Profile Header ──────────────────────────────────────── */}
      <div
        className={`rounded-2xl overflow-hidden shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 ${
          isTeknisi
            ? "bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500"
            : "bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500"
        }`}
      >
        <div className="px-6 py-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {mitra.fotoDiri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mitra.fotoDiri}
                alt={mitra.name || "Mitra"}
                className="w-20 h-20 rounded-2xl object-cover border-3 border-white/30 shadow-xl cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setPreviewPhoto(mitra.fotoDiri!)}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl">
                {isTeknisi ? (
                  <HiOutlineWrenchScrewdriver className="w-8 h-8 text-white/80" />
                ) : (
                  <HiOutlineMegaphone className="w-8 h-8 text-white/80" />
                )}
              </div>
            )}
            {mitra.requiresFaceVerification && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center shadow">
                <span className="text-[8px] font-black text-amber-900">!</span>
              </span>
            )}
          </div>
          {/* Info */}
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-white drop-shadow-sm">
              {mitra.name || mitra.email.split("@")[0]}
            </h2>
            <p className="text-white/70 text-sm mt-0.5">{mitra.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
              <Badge
                icon={
                  isTeknisi ? (
                    <HiOutlineWrenchScrewdriver className="w-3 h-3" />
                  ) : (
                    <HiOutlineMegaphone className="w-3 h-3" />
                  )
                }
              >
                {isTeknisi ? "Mitra Teknisi" : "Mitra Sales"}
              </Badge>
              <Badge variant={mitra.isActive ? "success" : "danger"}>
                {mitra.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
              {mitra.sites && (
                <Badge icon={<HiOutlineMapPin className="w-3 h-3" />}>
                  {mitra.sites.name}
                </Badge>
              )}
              {mitra.requiresFaceVerification && (
                <Badge
                  variant="warning"
                  icon={<HiOutlineCamera className="w-3 h-3" />}
                >
                  Menunggu Verif Wajah
                </Badge>
              )}
            </div>
          </div>
          {/* Wallet Summary (inline) */}
          {mitra.mitraWallet && (
            <div className="sm:ml-auto flex-shrink-0 text-center sm:text-right bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20">
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">
                Saldo Wallet
              </p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {fmt(mitra.mitraWallet.balance)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Content Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Col Left (5 cols) ───────────────────────────────── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Informasi Pribadi */}
          <Section icon={<HiOutlineIdentification />} title="Informasi Pribadi">
            <div className="space-y-1">
              <DataRow label="Email" value={mitra.email} />
              <DataRow label="Telepon" value={mitra.phone || "-"} />
              <DataRow label="NIK" value={mitra.nik || "-"} mono />
              <DataRow
                label="Tempat, Tgl Lahir"
                value={
                  mitra.tempatLahir
                    ? `${mitra.tempatLahir}, ${fmtDate(mitra.tanggalLahir)}`
                    : "-"
                }
              />
              <DataRow label="Alamat" value={mitra.alamat || "-"} />
              {mitra.latitudeRumah && mitra.longitudeRumah && (
                <div className="pt-1">
                  <a
                    href={`https://maps.google.com/?q=${mitra.latitudeRumah},${mitra.longitudeRumah}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    <HiOutlineMapPin className="w-3 h-3" />
                    Lihat di Google Maps
                  </a>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
              <DataRow label="Bergabung" value={fmtDate(mitra.createdAt)} />
              <DataRow
                label="Verif Wajah Terakhir"
                value={fmtDateTime(mitra.lastFaceVerification)}
              />
            </div>
          </Section>

          {/* Wallet Detail */}
          <Section icon={<HiOutlineWallet />} title="Wallet">
            {mitra.mitraWallet ? (
              <>
                <div className="text-center py-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                    Total Saldo
                  </p>
                  <p className="text-3xl font-extrabold text-green-600 dark:text-green-400 mt-1">
                    {fmt(mitra.mitraWallet.balance)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <MiniStat
                    label="Total Pendapatan"
                    value={fmt(mitra.mitraWallet.totalEarnings)}
                    color="emerald"
                  />
                  <MiniStat
                    label="Total Dicairkan"
                    value={fmt(mitra.mitraWallet.totalWithdrawn)}
                    color="amber"
                  />
                </div>
              </>
            ) : (
              <EmptyState text="Wallet belum dibuat" />
            )}
          </Section>

          {/* Dokumen KYC */}
          <Section icon={<HiOutlineDocumentText />} title="Dokumen KYC">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Foto Diri", url: mitra.fotoDiri },
                { label: "KTP", url: mitra.fotoKtp },
                { label: "SIM", url: mitra.fotoSim },
                { label: "KK", url: mitra.fotoKk },
              ].map((doc) => (
                <div key={doc.label} className="text-center group">
                  {doc.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.url}
                      alt={doc.label}
                      className="w-full aspect-square object-cover rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer group-hover:ring-2 group-hover:ring-indigo-400 group-hover:shadow-md transition-all"
                      onClick={() => setPreviewPhoto(doc.url!)}
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">
                        N/A
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                    {doc.label}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Col Right (7 cols) ──────────────────────────────── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Komisi & Bank & Garansi */}
          <Section icon={<HiOutlineBanknotes />} title="Komisi, Bank & Garansi">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Rate Komisi */}
              <div>
                <SectionLabel>Rate Komisi</SectionLabel>
                <div className="space-y-2">
                  {isTeknisi ? (
                    <>
                      <KomisiRow
                        label="WO PSB / Instalasi"
                        value={fmt(mitra.mitraRateWoPsb)}
                      />
                      <KomisiRow
                        label="WO Maintenance"
                        value={fmt(mitra.mitraRateWoMaintenance)}
                      />
                    </>
                  ) : (
                    <>
                      <KomisiRow
                        label="Per Canvasing Installed"
                        value={fmt(mitra.mitraRateCanvasing)}
                      />
                      <KomisiRow
                        label="Target Harian"
                        value={`${mitra.targetHarian ?? "-"}`}
                        suffix="canvasing"
                      />
                    </>
                  )}
                  <KomisiRow
                    label="Min. Pencairan"
                    value={fmt(mitra.minWithdrawal)}
                  />
                </div>
              </div>

              {/* Bank + Garansi */}
              <div className="space-y-5">
                <div>
                  <SectionLabel>Informasi Bank</SectionLabel>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 space-y-2 text-sm">
                    <BankRow label="Bank" value={mitra.bankName || "-"} />
                    <BankRow
                      label="No. Rekening"
                      value={mitra.bankAccountNo || "-"}
                      mono
                    />
                    <BankRow
                      label="Atas Nama"
                      value={mitra.bankAccountName || "-"}
                    />
                  </div>
                </div>
                {isTeknisi && (
                  <div>
                    <SectionLabel>Garansi & Penalti</SectionLabel>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 space-y-2 text-sm">
                      <BankRow
                        label="Masa Garansi"
                        value={`${mitra.garansiHari ?? 7} hari`}
                      />
                      <BankRow
                        label="SLA Respon"
                        value={`${mitra.slaGaransiJam ?? 24} jam`}
                      />
                      <BankRow
                        label="Denda PSB"
                        value={fmt(mitra.penaltyPsb)}
                        danger
                      />
                      <BankRow
                        label="Denda Maintenance"
                        value={fmt(mitra.penaltyMaintenance)}
                        danger
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* History Verifikasi Wajah */}
          <Card className="border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 py-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <HiOutlineShieldCheck className="w-4 h-4 text-gray-400" />
                History Verifikasi Wajah
                {faceLogsTotal > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {faceLogsTotal}
                  </span>
                )}
              </CardTitle>
              {faceLogsTotal > 5 && faceLogsPage === 1 && (
                <button
                  onClick={() => fetchFaceLogs(1)}
                  className="text-[11px] text-indigo-600 hover:underline font-medium"
                >
                  Lihat Semua
                </button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {faceLogsLoading ? (
                <div className="p-10 text-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : faceLogs.length === 0 ? (
                <div className="p-10 text-center">
                  <HiOutlineCamera className="w-8 h-8 mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs text-gray-400">
                    Belum ada riwayat verifikasi wajah
                  </p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
                    Riwayat muncul setelah mitra melakukan face verification
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {faceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={log.photoUrl}
                          alt="Verifikasi"
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all flex-shrink-0"
                          onClick={() => setPreviewPhoto(log.photoUrl)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <HiOutlineClock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {fmtDateTime(log.createdAt)}
                            </span>
                          </div>
                          {log.latitude && log.longitude && (
                            <a
                              href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-0.5"
                            >
                              <HiOutlineMapPin className="w-2.5 h-2.5" />
                              {log.latitude.toFixed(4)},{" "}
                              {log.longitude.toFixed(4)}
                            </a>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 flex-shrink-0">
                          <HiOutlineShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                    ))}
                  </div>
                  {faceLogsTotalPages > 1 && (
                    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Hal. {faceLogsPage}/{faceLogsTotalPages}
                      </span>
                      <div className="flex gap-1.5">
                        <PagBtn
                          label="← Prev"
                          disabled={faceLogsPage <= 1}
                          onClick={() => fetchFaceLogs(faceLogsPage - 1)}
                        />
                        <PagBtn
                          label="Next →"
                          disabled={faceLogsPage >= faceLogsTotalPages}
                          onClick={() => fetchFaceLogs(faceLogsPage + 1)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden">
      <CardHeader className="py-3.5 px-5 border-b border-gray-100 dark:border-gray-800">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <span className="text-gray-400">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
      {children}
    </p>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-gray-800 dark:text-gray-200 text-right ml-4 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function KomisiRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3.5 py-2.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {value}
        {suffix && (
          <span className="text-gray-400 font-normal ml-1">{suffix}</span>
        )}
      </span>
    </div>
  );
}

function BankRow({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`text-xs font-medium ${danger ? "text-red-500" : "text-gray-800 dark:text-gray-200"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-400",
  };
  return (
    <div className={`rounded-xl p-3 text-center ${colorMap[color] || ""}`}>
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function Badge({
  children,
  variant,
  icon,
}: {
  children: React.ReactNode;
  variant?: "success" | "danger" | "warning";
  icon?: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-white/20 text-white border-white/20",
    success: "bg-emerald-400/20 text-emerald-100 border-emerald-400/30",
    danger: "bg-red-400/20 text-red-100 border-red-400/30",
    warning: "bg-amber-400/20 text-amber-100 border-amber-400/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${styles[variant || "default"]}`}
    >
      {icon}
      {children}
    </span>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap: Record<string, string> = {
    indigo:
      "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40",
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40",
    purple:
      "bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40",
    gray: "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all ${colorMap[color] || ""} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PagBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 text-[10px] rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-4">
      {text}
    </p>
  );
}
