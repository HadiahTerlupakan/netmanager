"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { HiArrowPath } from "react-icons/hi2";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/hooks/useApi";
import { PppClientFormActions } from "@/app/admin/pelanggan/ppp/components/actions/PppClientFormActions";
import { PppClientInfoTabSection } from "@/app/admin/pelanggan/ppp/components/info/PppClientInfoTabSection";
import { PppClientSiteSection } from "@/app/admin/pelanggan/ppp/components/info/PppClientSiteSection";
import { PppClientMapPickerModal } from "@/app/admin/pelanggan/ppp/components/modal/PppClientMapPickerModal";
import { PppClientBillingPreferencesSection } from "@/app/admin/pelanggan/ppp/components/package/PppClientBillingPreferencesSection";
import { PppClientPackageChangeSection } from "@/app/admin/pelanggan/ppp/components/package/PppClientPackageChangeSection";
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
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
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

export function PppClientEditForm() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const [_existingFileKTP, setExistingFileKTP] = useState<string | null>(null);
  const [_existingFileRumahSekitar, setExistingFileRumahSekitar] = useState<
    string | null
  >(null);
  const [_existingFileBAST, setExistingFileBAST] = useState<string | null>(
    null,
  );
  const [originalIdPelanggan, setOriginalIdPelanggan] = useState<string | null>(
    null,
  );
  /** ID paket saat data pertama kali dimuat — digunakan untuk deteksi perubahan paket */
  const [originalHargaPaketId, setOriginalHargaPaketId] = useState<string>("");
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
    status: "AKTIF" as
      | "AKTIF"
      | "NONAKTIF"
      | "MAINTENANCE"
      | "ISOLIR"
      | "DISMANTLE",
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
    siteId: "",
    invoiceAction: "UPDATE_ONLY" as "UPDATE_ONLY" | "VOID_AND_CREATE_NEW",
    // Opsi perubahan paket — hanya dikirim saat hargaPaketId berubah
    prorateOption: "NONE" as "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT",
    downgradeAdjustment: "NONE" as "NONE" | "REFUND" | "CREDIT",
    upgradeApplyTime: "IMMEDIATE" as "IMMEDIATE" | "NEXT_CYCLE",
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
    jatuhTempoManuallyEdited,
    setJatuhTempoManuallyEdited,
    handleChange: baseHandleChange,
    totalInfo,
    formatRupiah,
    updateBillingPreferencesFormData,
    updateInfoTabFormData,
  } = usePppFormOrchestration({
    initialFormData,
    hargaPakets,
    allowNonPositiveProrate: true,
  });

  const { idPelangganError, checkingId, resetIdPelangganError } =
    usePppIdValidation({
      idPelanggan: formData.idPelanggan,
      originalIdPelanggan,
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

  // Load data existing pelanggan
  const loadPelangganData = useCallback(async () => {
    if (!id) return;

    try {
      setLoadingData(true);
      // Note: We use basic fetch here because we need 'no-store' cache option which fetchWithHandling might overwrite or genericize
      // But we can implement error handling manually or use fetchWithHandling if we add options

      const res = await fetch(`/api/pelanggan-ppp/${id}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          showToast(
            "error",
            `Terlalu banyak permintaan. Tunggu ${retryAfter || 60} detik.`,
          );
          return;
        }
        throw new Error("Gagal memuat data pelanggan");
      }
      const responseData = await res.json();
      const data = responseData.data;

      if (!data) {
        throw new Error("Data pelanggan tidak ditemukan dalam respons");
      }

      // Pre-fill form dengan data existing
      setFormData({
        idPelanggan: data.idPelanggan || "",
        nama: data.nama || "",
        username: data.username || "",
        // Sengaja kosong, bukan dari `data`. Server tidak pernah mengirim
        // balik password: `password` di-strip dari response dan
        // `passwordLogin` tidak punya kolom di database. Kosong berarti
        // "tidak diubah".
        password: "",
        passwordLogin: "",
        hargaPaketId: data.hargaPaketId || "",
        tipe: data.tipe || "REGULER",
        tanggalAktif: data.tanggalAktif
          ? (new Date(data.tanggalAktif).toISOString().split("T")[0] ?? "")
          : ((() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            })() ?? ""),
        jatuhTempo: data.jatuhTempo
          ? (new Date(data.jatuhTempo).toISOString().split("T")[0] ?? "")
          : "",
        status: data.status || "AKTIF",
        autoIsolir: data.autoIsolir ?? true, // Load from DB, default true
        alamat: data.alamat || "",
        provinsi: data.provinsi || "",
        kabupatenKota: data.kabupatenKota || "",
        kelurahanDesa: data.kelurahanDesa || "",
        kecamatan: data.kecamatan || "",
        noTelp: data.noTelp || "",
        email: data.email || "",
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        jenisDokumen: data.jenisDokumen || null,
        noDokumen: data.noDokumen || "",
        catatan: data.catatan || "",
        usePPN: data.usePPN ?? true,
        useDiscount: data.useDiscount ?? false,
        useProrate: data.useProrate ?? false,
        discountType: data.discountType || null,
        discountValue: data.discountValue || null,
        discountDuration: data.discountDuration || null,
        discountDurationUnit: data.discountDurationUnit || null,
        biayaInstalasi: data.biayaInstalasi || null,
        biayaInstalasiIsRecurring: data.biayaInstalasiIsRecurring ?? false,
        useDiskonBiayaInstalasi: data.biayaInstalasiDiskon ? true : false,
        biayaInstalasiDiskon: data.biayaInstalasiDiskon || null,
        biayaSewaPerangkat: data.biayaSewaPerangkat || null,
        biayaSewaPerangkatIsRecurring:
          data.biayaSewaPerangkatIsRecurring ?? true,
        useDiskonSewaPerangkat: data.biayaSewaPerangkatDiskon ? true : false,
        biayaSewaPerangkatDiskon: data.biayaSewaPerangkatDiskon || null,
        biayaLainnya: data.biayaLainnya || null,
        biayaLainnyaIsRecurring: data.biayaLainnyaIsRecurring ?? false,
        useDiskonBiayaLainnya: data.biayaLainnyaDiskon ? true : false,
        biayaLainnyaDiskon: data.biayaLainnyaDiskon || null,
        keteranganBiayaLainnya: data.keteranganBiayaLainnya || "",
        odpId: data.odpId || "",
        resellerId: data.resellerId || "",
        resellerOutletId: data.resellerOutletId || "",
        siteId: data.siteId || "",
        invoiceAction: "UPDATE_ONLY",
        // Reset opsi perubahan paket ke default saat data dimuat
        prorateOption: "NONE",
        downgradeAdjustment: "NONE",
        upgradeApplyTime: "IMMEDIATE",
      });

      // Set existing file paths
      setExistingFileKTP(data.fileKTP || null);
      setExistingFileRumahSekitar(data.fileRumahSekitar || null);
      setExistingFileBAST(data.fileBAST || null);
      setOriginalIdPelanggan(data.idPelanggan || null);
      setOriginalHargaPaketId(data.hargaPaketId || "");
      // Reset flag manual edit saat data dimuat
      setJatuhTempoManuallyEdited(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data";
      setError(message);
      showToast("error", message);
    } finally {
      setLoadingData(false);
    }
  }, [id, setFormData, setJatuhTempoManuallyEdited, showToast]);

  const { data: hargaPaketsData, isLoading: loadingHargaPakets } = useApi<
    HargaPaket[]
  >("/api/hargapakets?status=AKTIF");
  const { data: odpsData } = useApi<{ odps: Odp[] }>("/api/odps");
  const { data: resellersData } = useApi<readonly ResellerOption[]>(
    // Lihat catatan batas yang sama di form tambah pelanggan.
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

  const [didHydrateOdps, setDidHydrateOdps] = useState(false);
  if (odpsData?.odps && !didHydrateOdps) {
    setDidHydrateOdps(true);
    setOdps(odpsData.odps);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (id) {
        void loadPelangganData();
      }
    }, 0);
    return () => clearTimeout(handle);
  }, [id, loadPelangganData]);

  /**
   * Menentukan apakah perubahan paket merupakan downgrade berdasarkan
   * perbandingan harga paket lama vs baru. Mengembalikan null saat data
   * paket belum dimuat atau salah satu ID tidak ditemukan — caller harus
   * menahan render section prorate sampai status pasti, supaya badge
   * "Upgrade/Downgrade" tidak menyesatkan user (mis. kasus C7).
   */
  const computeIsDowngrade = (oldId: string, newId: string): boolean | null => {
    if (hargaPakets.length === 0) return null;
    const oldPkg = hargaPakets.find((p) => p.id === oldId);
    const newPkg = hargaPakets.find((p) => p.id === newId);
    if (!oldPkg || !newPkg) return null;
    return newPkg.harga < oldPkg.harga;
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validatePppClientForm(formData, {
      mode: "edit",
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

      // Append opsi perubahan paket jika paket berubah
      if (
        formData.hargaPaketId !== originalHargaPaketId &&
        originalHargaPaketId !== ""
      ) {
        formDataToSend.append("prorateOption", formData.prorateOption);
        formDataToSend.append(
          "downgradeAdjustment",
          formData.downgradeAdjustment,
        );
        formDataToSend.append("upgradeApplyTime", formData.upgradeApplyTime);
      }

      // Debug: Log ID yang akan dikirim
      clientLogger.info("[Frontend PUT] ID pelanggan:", id, "Type:", typeof id);
      clientLogger.info("[Frontend PUT] URL:", `/api/pelanggan-ppp/${id}`);

      const res = await fetch(`/api/pelanggan-ppp/${id}`, {
        method: "PUT",
        body: formDataToSend,
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      clientLogger.info(
        "[Frontend PUT] Response status:",
        res.status,
        res.statusText,
      );

      if (!res.ok) {
        let errorData: { error?: string } = {};
        try {
          const parsed = (await res.json()) as { error?: unknown };
          if (typeof parsed.error === "string") {
            errorData.error = parsed.error;
          }
        } catch (_e) {
          errorData = { error: `HTTP ${res.status}: ${res.statusText}` };
        }
        clientLogger.error("[Frontend PUT] Error response:", errorData);

        // Handle rate limit
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          showToast(
            "error",
            `Terlalu banyak permintaan. Tunggu ${retryAfter || 60} detik.`,
          );
          return;
        }

        throw new Error(errorData.error || "Gagal menyimpan pelanggan PPP");
      }

      // Berhasil, redirect ke halaman list dengan refresh
      showToast("success", "Data pelanggan berhasil diperbarui");
      router.push("/admin/pelanggan/ppp");
      router.refresh(); // Force refresh untuk memastikan data terbaru dimuat
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

  const editStatusOptions = [
    { value: "AKTIF", label: "Aktif sekarang" },
    { value: "NONAKTIF", label: "Menunggu" },
    {
      value: "ISOLIR",
      label: "Isolir (Menunggak)",
      accentClassName: "text-orange-600",
    },
    {
      value: "DISMANTLE",
      label: "Dismantle (Berhenti)",
      accentClassName: "text-red-600",
    },
  ];

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <HiArrowPath className="w-5 h-5 animate-spin" />
          <span>Memuat data pelanggan...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Edit Pelanggan PPP
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Edit data pelanggan dengan koneksi PPPoE
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form - 2 kolom */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
                    helperText="Ubah site jika ada pemindahan pelanggan. Akan mereset paket & ODP yang dipilih."
                    onSiteChange={(siteId) => {
                      setFormData((prev) => ({
                        ...prev,
                        siteId: siteId || "",
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
                    statusOptions={editStatusOptions}
                    onStatusChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: value as
                          | "AKTIF"
                          | "NONAKTIF"
                          | "MAINTENANCE"
                          | "ISOLIR"
                          | "DISMANTLE",
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
                    roundedClassName="rounded-lg"
                    actionSlot={
                      jatuhTempoManuallyEdited ? (
                        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Tindakan Tagihan{" "}
                            <span className="text-red-500">*</span>
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Karena tanggal jatuh tempo diubah, pilih tindakan
                            yang akan dilakukan terhadap tagihan pelanggan.
                          </p>
                          <div className="space-y-3 mt-2">
                            <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-gray-200 dark:border-gray-700">
                              <input
                                type="radio"
                                name="invoiceAction"
                                value="UPDATE_ONLY"
                                checked={
                                  formData.invoiceAction === "UPDATE_ONLY"
                                }
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    invoiceAction: e.target.value as
                                      | "UPDATE_ONLY"
                                      | "VOID_AND_CREATE_NEW",
                                  }))
                                }
                                className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                              />
                              <div>
                                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                  Hanya Ubah Tanggal
                                </span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Tagihan bulan ini akan dibiarkan, tagihan baru
                                  akan digenerate otomatis pada tanggal jatuh
                                  tempo yang baru. Cocok untuk pelanggan
                                  pascabayar reguler.
                                </span>
                              </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-gray-200 dark:border-gray-700">
                              <input
                                type="radio"
                                name="invoiceAction"
                                value="VOID_AND_CREATE_NEW"
                                checked={
                                  formData.invoiceAction ===
                                  "VOID_AND_CREATE_NEW"
                                }
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    invoiceAction: e.target.value as
                                      | "UPDATE_ONLY"
                                      | "VOID_AND_CREATE_NEW",
                                  }))
                                }
                                className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                              />
                              <div>
                                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                  Batalkan & Buat Tagihan Baru
                                </span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Batalkan tagihan bulan ini yang belum lunas,
                                  dan langsung buat tagihan baru sesuai dengan
                                  tanggal jatuh tempo yang baru.
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      ) : null
                    }
                  />

                  {/* Section perubahan paket — muncul saat hargaPaketId berubah dari nilai awal */}
                  {(() => {
                    const packageChanged =
                      formData.hargaPaketId !== originalHargaPaketId &&
                      originalHargaPaketId !== "";
                    if (!packageChanged) return null;

                    const downgradeStatus = computeIsDowngrade(
                      originalHargaPaketId,
                      formData.hargaPaketId,
                    );

                    if (downgradeStatus === null) {
                      return (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic border-t-2 border-amber-200 dark:border-amber-800 pt-4 mt-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                          Memuat data paket untuk menentukan opsi prorate…
                        </div>
                      );
                    }

                    return (
                      <PppClientPackageChangeSection
                        prorateOption={formData.prorateOption}
                        downgradeAdjustment={formData.downgradeAdjustment}
                        upgradeApplyTime={formData.upgradeApplyTime}
                        isDowngrade={downgradeStatus}
                        loading={loading}
                        onFieldChange={handleChange}
                        roundedClassName="rounded-lg"
                      />
                    );
                  })()}

                  <PppClientBillingPreferencesSection
                    formData={formData}
                    handleChange={handleChange}
                    updateFormData={updateBillingPreferencesFormData}
                    formatRupiah={formatRupiah}
                    roundedClassName="rounded-lg"
                  />
                </div>
              )}

              {activeTab === "info" && (
                <PppClientInfoTabSection
                  isEditMode
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
                  roundedClassName="rounded-lg"
                />
              )}

              <PppClientFormActions
                error={error}
                submitting={submitting}
                loading={loading}
                roundedClassName="rounded-lg"
                cancelHref="/admin/pelanggan/ppp"
              />
            </form>
          </div>
        </div>

        {/* Panel Informasi - 1 kolom */}
        {mounted && (
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-5">
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
                  roundedClassName="rounded-lg"
                />
              ) : (
                <PppClientBillingSummarySidebar
                  activeTab={activeTab}
                  formData={formData}
                  hargaPaketsLength={hargaPakets.length}
                  isLoadingHargaPakets={loadingHargaPakets}
                  totalInfo={totalInfo}
                  formatRupiah={formatRupiah}
                  roundedClassName="rounded-lg"
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
        roundedClassName="rounded-lg"
      />
    </div>
  );
}
