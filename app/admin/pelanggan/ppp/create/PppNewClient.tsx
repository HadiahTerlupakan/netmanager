"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/hooks/useApi";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import { PppClientFormActions } from "@/app/admin/pelanggan/ppp/components/actions/PppClientFormActions";
import { PppClientInfoTabSection } from "@/app/admin/pelanggan/ppp/components/info/PppClientInfoTabSection";
import { PppClientSiteSection } from "@/app/admin/pelanggan/ppp/components/info/PppClientSiteSection";
import { PppClientMapPickerModal } from "@/app/admin/pelanggan/ppp/components/modal/PppClientMapPickerModal";
import { PppClientBillingPreferencesSection } from "@/app/admin/pelanggan/ppp/components/package/PppClientBillingPreferencesSection";
import { PppClientPackageDateSection } from "@/app/admin/pelanggan/ppp/components/package/PppClientPackageDateSection";
import { PppClientStatusTypeSection } from "@/app/admin/pelanggan/ppp/components/package/PppClientStatusTypeSection";
import { PppClientTabNavigation } from "@/app/admin/pelanggan/ppp/components/shell/PppClientTabNavigation";
import { PppClientBillingSummarySidebar } from "@/app/admin/pelanggan/ppp/components/sidebars/PppClientBillingSummarySidebar";
import { PppClientDocumentUploadSidebar } from "@/app/admin/pelanggan/ppp/components/sidebars/PppClientDocumentUploadSidebar";
import {
  buildPppClientFormData,
  validatePppClientForm,
} from "@/app/admin/pelanggan/ppp/shared/form";
import { usePppDocumentUploads } from "@/app/admin/pelanggan/ppp/hooks/usePppDocumentUploads";
import { usePppFormOrchestration } from "@/app/admin/pelanggan/ppp/hooks/usePppFormOrchestration";
import { usePppIdValidation } from "@/app/admin/pelanggan/ppp/hooks/usePppIdValidation";

type HargaPaket = {
  id: string;
  name: string;
  harga: number;
  durasi: number;
  durasiUnit: "JAM" | "HARI" | "BULAN" | "TAHUN";
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  usePPN?: boolean;
  ppnPercentage?: number | null;
  useDiscount?: boolean;
  discountType?: "FIXED" | "PERCENT" | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: "JAM" | "HARI" | "BULAN" | "TAHUN" | null;
  profilePPP?: { id: string; name: string } | null;
  bandwidth?: { id: string; name: string } | null;
};

type Odp = {
  id: string;
  name: string;
};

type ResellerOption = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
};

type ResellerOutletOption = {
  readonly id: string;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
};

export function PppClientCreateForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const initialFormData = {
    idPelanggan: "",
    nama: "",
    username: "",
    password: "123456", // Default password PPPoE
    passwordLogin: "123456", // Default password untuk login portal pelanggan
    hargaPaketId: "",
    tipe: "REGULER" as "REGULER" | "NON_REGULER",
    tanggalAktif:
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })() ?? "", // Default: hari ini
    jatuhTempo: "",
    status: "AKTIF" as "AKTIF" | "NONAKTIF" | "MAINTENANCE",
    autoIsolir: true, // Default: auto isolir aktif
    alamat: "",
    provinsi: "",
    kabupatenKota: "",
    kelurahanDesa: "",
    kecamatan: "",
    noTelp: "",
    email: "",
    latitude: null as number | null,
    longitude: null as number | null,
    jenisDokumen: null as "KTP" | "SIM" | "Paspor" | null,
    noDokumen: "",
    catatan: "",
    usePPN: true, // Gunakan PPN atau tidak
    useDiscount: false, // Gunakan diskon atau tidak
    useProrate: false, // Gunakan perhitungan prorate atau tidak
    // Custom diskon per pelanggan
    discountType: null as "FIXED" | "PERCENT" | null,
    discountValue: null as number | null,
    discountDuration: null as number | null,
    discountDurationUnit: null as "JAM" | "HARI" | "BULAN" | "TAHUN" | null,
    // Biaya lain-lain
    biayaInstalasi: null as number | null,
    biayaInstalasiIsRecurring: false, // Default: 1x
    useDiskonBiayaInstalasi: false, // Centang untuk menggunakan diskon biaya instalasi
    biayaInstalasiDiskon: null as number | null,
    biayaSewaPerangkat: null as number | null,
    biayaSewaPerangkatIsRecurring: true, // Default: berulang
    useDiskonSewaPerangkat: false, // Centang untuk menggunakan diskon sewa perangkat
    biayaSewaPerangkatDiskon: null as number | null,
    biayaLainnya: null as number | null,
    biayaLainnyaIsRecurring: false, // Default: 1x
    useDiskonBiayaLainnya: false, // Centang untuk menggunakan diskon biaya lainnya
    biayaLainnyaDiskon: null as number | null,
    keteranganBiayaLainnya: "",
    odpId: "", // ODP yang digunakan pelanggan
    resellerId: "",
    resellerOutletId: "",
    siteId: undefined as string | undefined,
    billingAction: "DO_NOTHING" as
      | "CREATE_PAID_INVOICE"
      | "CREATE_UNPAID_INVOICE"
      | "DO_NOTHING",
  };

  const {
    formData,
    setFormData,
    activeTab,
    setActiveTab,
    showPasswordLogin,
    setShowPasswordLogin,
    mounted,
    showMapPicker,
    setShowMapPicker,
    jatuhTempoManuallyEdited: _jatuhTempoManuallyEdited,
    handleChange: baseHandleChange,
    totalInfo,
    formatRupiah,
    updateBillingPreferencesFormData,
    updateInfoTabFormData,
  } = usePppFormOrchestration({
    initialFormData,
    hargaPakets,
    allowNonPositiveProrate: false,
  });

  const { idPelangganError, checkingId, resetIdPelangganError } =
    usePppIdValidation({
      idPelanggan: formData.idPelanggan,
    });

  const {
    fileKTP,
    fileRumahSekitar,
    fileBAST,
    scanningKTP,
    ktpScanError,
    ktpScanSuccess,
    handleSidebarKtpFileChange,
    handleSidebarRumahSekitarFileChange,
    handleSidebarBASTFileChange,
  } = usePppDocumentUploads({
    setFormData,
    setActiveTab,
  });

  // Generate ID pelanggan otomatis (angka unik 8 digit) - sync version (fallback)
  const generateIdPelangganSync = useCallback(() => {
    const now = new Date();
    // Menggunakan beberapa digit terakhir dari timestamp + random untuk memastikan unik
    const timestamp = now.getTime(); // Timestamp dalam milidetik
    const timestampStr = String(timestamp);
    // Ambil 5 digit terakhir dari timestamp (unik per detik/menit)
    const timestampPart = timestampStr.slice(-5);
    // Random 3 digit untuk memastikan tidak duplikat
    const random = Math.floor(Math.random() * 1000); // Random 0-999
    // Format: 5 digit timestamp + 3 digit random = 8 digit (contoh: 68001234)
    return timestampPart + String(random).padStart(3, "0");
  }, []);

  // Generate ID pelanggan dari API (async)
  const generateIdPelanggan = useCallback(async () => {
    try {
      const res = await fetchWithHandling<{ idPelanggan: string }>(
        "/api/pelanggan-ppp/generate-id",
      );
      if (res.data?.idPelanggan) {
        return res.data.idPelanggan;
      }
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync();
    } catch (error) {
      clientLogger.error("Error generating ID:", error);
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync();
    }
  }, [generateIdPelangganSync]);

  // Load atau generate ID pelanggan yang terjamin unik dari API
  const loadOrGenerateIdPelanggan = useCallback(async () => {
    try {
      // Panggil API untuk generate ID yang terjamin unik
      const res = await fetchWithHandling<{ idPelanggan: string }>(
        "/api/pelanggan-ppp/generate-id",
      );
      if (res.data?.idPelanggan) {
        return res.data.idPelanggan;
      }

      // Fallback: generate di frontend jika API error
      clientLogger.warn("API generate-id tidak tersedia, menggunakan fallback");
      return generateIdPelangganSync();
    } catch (error) {
      // Fallback: generate di frontend jika API error
      clientLogger.warn("Error memanggil API generate-id:", error);
      return generateIdPelangganSync();
    }
  }, [generateIdPelangganSync]);

  useEffect(() => {
    // Generate ID pelanggan otomatis saat component mount
    loadOrGenerateIdPelanggan().then((id) => {
      setFormData((prev) => ({
        ...prev,
        idPelanggan: id,
        username: id, // Set username sama dengan ID pelanggan secara default
      }));
    });
  }, [loadOrGenerateIdPelanggan, setFormData]); // Generate ID only once on mount

  const hargaPaketsUrl = (() => {
    const params = new URLSearchParams();
    params.append("status", "AKTIF");
    if (formData.siteId) {
      params.append("siteId", formData.siteId);
    }
    return `/api/hargapakets?${params.toString()}`;
  })();

  const odpsUrl = (() => {
    const params = new URLSearchParams();
    if (formData.siteId) {
      params.append("siteId", formData.siteId);
    }
    const qs = params.toString();
    return qs ? `/api/odps?${qs}` : "/api/odps";
  })();

  const { data: hargaPaketsData, isLoading: loadingHarga } =
    useApi<HargaPaket[]>(hargaPaketsUrl);
  const { data: odpsData } = useApi<{ odps: Odp[] }>(odpsUrl);
  const { data: resellersData } = useApi<readonly ResellerOption[]>(
    // Batas eksplisit: default endpoint hanya 20 baris, dan klien tidak
    // membaca `meta.total`, sehingga tenant dengan lebih banyak reseller tidak
    // bisa memilih sisanya.
    "/api/admin/resellers?limit=200",
  );
  // Bukan "active": endpoint mengembalikan seluruh reseller yang belum
  // dihapus, termasuk yang berstatus INACTIVE. Namanya diluruskan agar tidak
  // menyiratkan penyaringan yang tidak terjadi.
  const resellerOptions = [...(resellersData ?? [])];
  const selectedResellerId = formData.resellerId || null;
  const { data: resellerOutletsData } = useApi<readonly ResellerOutletOption[]>(
    selectedResellerId
      ? `/api/admin/resellers/${selectedResellerId}/outlets`
      : null,
  );
  const resellerOutlets = [...(resellerOutletsData ?? [])];

  const [didHydrateHarga, setDidHydrateHarga] = useState(false);
  if (hargaPaketsData && !didHydrateHarga) {
    setDidHydrateHarga(true);
    setHargaPakets(hargaPaketsData);
    setLoading(false);
  }

  if (!loadingHarga && loading && !hargaPaketsData) {
    setLoading(false);
  }

  const [didHydrateOdps, setDidHydrateOdps] = useState(false);
  if (odpsData?.odps && !didHydrateOdps) {
    setDidHydrateOdps(true);
    setOdps(odpsData.odps);
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validatePppClientForm(formData, {
      mode: "create",
      idPelangganError,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      // Buat FormData untuk mengirim file
      const formDataToSend = buildPppClientFormData(formData, {
        fileKTP,
        fileRumahSekitar,
        fileBAST,
      });

      // Use fetch directly for FormData, but handle response manually or assume backend returns standard format
      // Note: fetchWithHandling expects JSON usually, but we are sending FormData.
      // However, fetchWithHandling sets Content-Type to application/json by default which breaks FormData.
      // So we use raw fetch but handle errors similarly.

      const res = await fetch("/api/pelanggan-ppp", {
        method: "POST",
        body: formDataToSend,
        // Do NOT set Content-Type header for FormData, let browser set it with boundary
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        clientLogger.error("API Error details:", errorData);

        // Handle rate limit
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          showToast(
            "error",
            `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter || 60} detik.`,
          );
          return;
        }

        // Jika error karena ID duplikat, generate ID baru dan retry
        if (
          errorData.error?.includes("sudah digunakan") ||
          errorData.error?.includes("unique") ||
          res.status === 409
        ) {
          const newId = await generateIdPelanggan();
          setFormData((prev) => ({ ...prev, idPelanggan: newId }));
          setError(
            "ID Pelanggan sudah digunakan. ID baru telah di-generate. Silakan submit ulang.",
          );
          showToast("warning", "ID Pelanggan diperbarui karena duplikat");
          return;
        }
        throw new Error(errorData.error || "Gagal menyimpan pelanggan PPP");
      }

      // Berhasil, redirect ke halaman list
      showToast("success", "Pelanggan berhasil disimpan");
      router.push("/admin/pelanggan/ppp");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan data";
      setError(message);
      showToast("error", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    baseHandleChange(e, resetIdPelangganError);
  };

  const createStatusOptions = [
    { value: "AKTIF", label: "Aktif sekarang" },
    { value: "NONAKTIF", label: "Menunggu" },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Tambah Pelanggan PPP
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tambah pelanggan baru dengan koneksi PPPoE
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form - 2 kolom */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Tab Navigation */}
              <PppClientTabNavigation
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* Tab Content */}
              {activeTab === "paket" && (
                <div className="space-y-5">
                  <PppClientSiteSection
                    siteId={formData.siteId}
                    helperText="Pilih site terlebih dahulu untuk melihat Paket dan ODP yang tersedia."
                    onSiteChange={(siteId) => {
                      setFormData((prev) => ({
                        ...prev,
                        siteId,
                        hargaPaketId: "",
                        odpId: "",
                      }));
                    }}
                    roundedClassName="rounded-xl"
                  />

                  <PppClientStatusTypeSection
                    status={formData.status}
                    tipe={formData.tipe}
                    autoIsolir={formData.autoIsolir}
                    statusOptions={createStatusOptions}
                    onStatusChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: value as "AKTIF" | "NONAKTIF" | "MAINTENANCE",
                      }))
                    }
                    onTipeChange={(value) =>
                      setFormData((prev) => ({ ...prev, tipe: value }))
                    }
                    onAutoIsolirChange={(checked) =>
                      setFormData((prev) => ({ ...prev, autoIsolir: checked }))
                    }
                  />

                  <PppClientPackageDateSection
                    hargaPakets={hargaPakets}
                    hargaPaketId={formData.hargaPaketId}
                    tanggalAktif={formData.tanggalAktif}
                    jatuhTempo={formData.jatuhTempo}
                    loading={loading}
                    onFieldChange={handleChange}
                    roundedClassName="rounded-xl"
                    actionSlot={
                      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Opsi Penagihan Awal
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tentukan bagaimana tagihan pertama untuk pelanggan ini
                          akan ditangani.
                        </p>
                        <div className="space-y-3">
                          <label
                            className={`flex items-start gap-4 cursor-pointer p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${formData.billingAction === "CREATE_PAID_INVOICE" ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}`}
                          >
                            <input
                              type="radio"
                              name="billingAction"
                              value="CREATE_PAID_INVOICE"
                              checked={
                                formData.billingAction === "CREATE_PAID_INVOICE"
                              }
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  billingAction: e.target.value as
                                    | "CREATE_PAID_INVOICE"
                                    | "CREATE_UNPAID_INVOICE"
                                    | "DO_NOTHING",
                                }))
                              }
                              className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Prepaid: Buat & Lunas{" "}
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  Disarankan
                                </span>
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Tagihan langsung dibuat dan statusnya{" "}
                                <b>LUNAS</b>. Disarankan untuk pendaftaran baru
                                yang pelanggan sudah langsung membayar.
                                Pemasukan akan langsung dicatat.
                              </span>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-4 cursor-pointer p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${formData.billingAction === "CREATE_UNPAID_INVOICE" ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}`}
                          >
                            <input
                              type="radio"
                              name="billingAction"
                              value="CREATE_UNPAID_INVOICE"
                              checked={
                                formData.billingAction ===
                                "CREATE_UNPAID_INVOICE"
                              }
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  billingAction: e.target.value as
                                    | "CREATE_PAID_INVOICE"
                                    | "CREATE_UNPAID_INVOICE"
                                    | "DO_NOTHING",
                                }))
                              }
                              className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Prepaid: Buat & Belum Lunas
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Tagihan langsung dibuat dengan status{" "}
                                <b>BELUM LUNAS</b>. Pelanggan dapat melihat
                                tagihan ini di aplikasi dan harus membayarnya.
                              </span>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-4 cursor-pointer p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${formData.billingAction === "DO_NOTHING" ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}`}
                          >
                            <input
                              type="radio"
                              name="billingAction"
                              value="DO_NOTHING"
                              checked={formData.billingAction === "DO_NOTHING"}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  billingAction: e.target.value as
                                    | "CREATE_PAID_INVOICE"
                                    | "CREATE_UNPAID_INVOICE"
                                    | "DO_NOTHING",
                                }))
                              }
                              className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                Postpaid: Jangan Buat Tagihan
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Tagihan pertama akan otomatis dibuat{" "}
                                <b>mendekati tanggal jatuh tempo berikutnya</b>.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    }
                  />

                  <PppClientBillingPreferencesSection
                    formData={formData}
                    handleChange={handleChange}
                    updateFormData={updateBillingPreferencesFormData}
                    formatRupiah={formatRupiah}
                    roundedClassName="rounded-xl"
                  />
                </div>
              )}

              {activeTab === "info" && (
                <PppClientInfoTabSection
                  formData={formData}
                  handleChange={handleChange}
                  updateFormData={updateInfoTabFormData}
                  idPelangganError={idPelangganError}
                  checkingId={checkingId}
                  odps={odps}
                  resellers={resellerOptions}
                  resellerOutlets={resellerOutlets}
                  showPasswordLogin={showPasswordLogin}
                  onToggleShowPasswordLogin={() =>
                    setShowPasswordLogin(!showPasswordLogin)
                  }
                  onOpenMapPicker={() => setShowMapPicker(true)}
                  roundedClassName="rounded-xl"
                />
              )}

              <PppClientFormActions
                error={error}
                submitting={submitting}
                loading={loading}
                roundedClassName="rounded-xl"
                cancelHref="/admin/pelanggan/ppp"
              />
            </form>
          </div>
        </div>

        {/* Panel Informasi - 1 kolom */}
        {mounted && (
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-5">
              {activeTab === "info" ? (
                <PppClientDocumentUploadSidebar
                  fileKTP={fileKTP}
                  fileRumahSekitar={fileRumahSekitar}
                  fileBAST={fileBAST}
                  scanningKTP={scanningKTP}
                  ktpScanError={ktpScanError}
                  ktpScanSuccess={ktpScanSuccess}
                  onKtpFileChange={handleSidebarKtpFileChange}
                  onRumahSekitarFileChange={handleSidebarRumahSekitarFileChange}
                  onBASTFileChange={handleSidebarBASTFileChange}
                  roundedClassName="rounded-xl"
                />
              ) : (
                <PppClientBillingSummarySidebar
                  activeTab={activeTab}
                  formData={formData}
                  hargaPaketsLength={hargaPakets.length}
                  isLoadingHargaPakets={loadingHarga}
                  totalInfo={totalInfo}
                  formatRupiah={formatRupiah}
                  roundedClassName="rounded-xl"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <PppClientMapPickerModal
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        latitude={formData.latitude}
        longitude={formData.longitude}
        onChange={(lat, lon) => {
          setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lon,
          }));
        }}
        roundedClassName="rounded-xl"
      />
    </div>
  );
}
