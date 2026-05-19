"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  HiArrowLeft,
  HiSparkles,
  HiBolt,
  HiUserCircle,
  HiMagnifyingGlass,
  HiMapPin,
  HiWifi,
  HiClock,
  HiArchiveBoxArrowDown,
  HiPlusCircle,
  HiCloud,
  HiWrenchScrewdriver,
  HiSignal,
  HiEye,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { useApi } from "@/lib/hooks/useApi";
import {
  readMixRadiusSearchResponse,
  type MixRadiusCustomer,
} from "./mixradius-search";

interface Pelanggan {
  id: string;
  idPelanggan: string;
  nama: string;
  alamat?: string;
  noTelp?: string;
}

interface Site {
  id: string;
  code: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

export function ClientComponent() {
  const { data: _session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [woType, setWoType] = useState<"CUSTOMER" | "INTERNAL">("CUSTOMER"); // Toggle Customer vs Internal
  const [isGuest, setIsGuest] = useState(true); // Default to Guest Mode
  const [searchSource, setSearchSource] = useState<"LOCAL" | "MIXRADIUS">(
    "MIXRADIUS",
  );

  // Sites dan Departments via TanStack Query (hanya saat authenticated).
  // useApi sudah unwrap envelope { success, data } via fetchWithHandling,
  // jadi tipe generic langsung diset ke array dari payload server.
  const isAuthenticated = status === "authenticated";
  const { data: sitesData, error: sitesError } = useApi<Site[]>(
    isAuthenticated ? "/api/admin/sites?activeOnly=true" : null,
  );
  const { data: departmentsData, error: departmentsError } = useApi<
    Department[]
  >(isAuthenticated ? "/api/admin/departments" : null);

  useEffect(() => {
    if (sitesError) {
      clientLogger.error("Error fetching sites:", sitesError);
    }
  }, [sitesError]);
  useEffect(() => {
    if (departmentsError) {
      clientLogger.error("Error fetching departments:", departmentsError);
    }
  }, [departmentsError]);

  const sites: Site[] = sitesData ?? [];
  const departments: Department[] = departmentsData ?? [];

  // Search states
  const [searchingPelanggan, setSearchingPelanggan] = useState(false);
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [mixRadiusList, setMixRadiusList] = useState<MixRadiusCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearchParams();

  // Form states
  const [formData, setFormData] = useState({
    ticketId: "",
    pelangganId: "",
    pelangganDisplay: "",
    siteId: "",
    departmentId: "",
    type: "TROUBLESHOOT",
    title: "",
    description: "",
    priority: "NORMAL",
    locationAddress: "",
    contactName: "",
    contactPhone: "",
    scheduledDate: "",
    scheduledTimeStart: "",
    scheduledTimeEnd: "",
    disconnectionReason: "",
    templateId: "",
  });

  const selectPelanggan = useCallback((p: Pelanggan) => {
    setFormData((prev) => ({
      ...prev,
      pelangganId: p.id,
      pelangganDisplay: `${p.nama} (${p.idPelanggan})`,
      contactName: p.nama,
      contactPhone: p.noTelp || "",
      locationAddress: p.alamat || "",
    }));
    setSearchQuery("");
    setPelangganList([]);
    setIsGuest(false); // Switch to linked mode
  }, []);

  // Handle URL params for Ticket integration
  useEffect(() => {
    const ticketId = searchParams.get("ticketId");
    if (!ticketId) return undefined;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/support-tickets/${ticketId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.ticket) {
            const ticket = data.ticket;

            setFormData((prev) => ({
              ...prev,
              ticketId: ticket.id,
              title: ticket.title || "",
              description: ticket.description || "",
              priority: ticket.priority || "NORMAL",
            }));

            if (ticket.pelanggan) {
              const p = ticket.pelanggan;
              const customerData: Pelanggan = {
                id: p.id,
                idPelanggan: p.idPelanggan,
                nama: p.nama,
                alamat: p.alamat || "", // Handle null alamat
                noTelp: p.noTelp || "", // Handle null noTelp
              };

              // Directly populate customer data and switch mode
              selectPelanggan(customerData);
            }
          }
        })
        .catch((err) => {
          clientLogger.error("Error fetching ticket details:", err);
          // Fallback to URL params if fetch fails
          const title = searchParams.get("title");
          const description = searchParams.get("description");
          const priority = searchParams.get("priority");

          setFormData((prev) => ({
            ...prev,
            ticketId: ticketId || "",
            title: title || "",
            description: description || "",
            priority: priority || "NORMAL",
          }));
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(handle);
  }, [searchParams, selectPelanggan]);

  const searchPelanggan = useCallback(async () => {
    setSearchingPelanggan(true);
    try {
      const response = await fetch(
        `/api/pelanggan-ppp?search=${searchQuery}&limit=10`,
      );
      if (response.ok) {
        const result = await response.json();
        setPelangganList(result.data || []);
      }
    } catch (error: unknown) {
      clientLogger.error("Error searching pelanggan:", error);
      toast.error("Gagal mencari pelanggan. Silakan coba lagi.");
    } finally {
      setSearchingPelanggan(false);
    }
  }, [searchQuery]);

  const searchMixRadius = useCallback(async () => {
    setSearchingPelanggan(true);
    try {
      const response = await fetch(
        `/api/integrations/mixradius/customers?search=${searchQuery}&searchType=all&start=0&length=10`,
      );
      const customers = await readMixRadiusSearchResponse(response);
      setMixRadiusList(customers);
    } catch (error: unknown) {
      clientLogger.error("Error searching MixRadius:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Gagal mencari data MixRadius. Silakan coba lagi.";
      toast.error(message);
      setMixRadiusList([]);
    } finally {
      setSearchingPelanggan(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;

    const performSearch = async () => {
      if (searchQuery.length > 2 && isMounted) {
        if (searchSource === "LOCAL") {
          await searchPelanggan();
        } else {
          await searchMixRadius();
        }
      } else if (isMounted) {
        setPelangganList([]);
        setMixRadiusList([]);
      }
    };

    const timeoutId = setTimeout(performSearch, 500); // Debounce

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, searchSource, searchPelanggan, searchMixRadius]);

  const selectMixRadiusCustomer = async (c: MixRadiusCustomer) => {
    setSearchingPelanggan(true); // Reuse loading state
    try {
      // Call Sync API
      const response = await fetch("/api/integrations/mixradius/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });

      if (response.ok) {
        const result = await response.json();
        const syncedCustomer = result.customer;

        // Success: Use Guest Mode with MixRadius Data
        setFormData((prev) => ({
          ...prev,
          pelangganId: "", // No local ID relation
          pelangganDisplay: `${c.fullname} (${c.username})`,
          contactName: c.fullname,
          contactPhone: syncedCustomer?.phoneNumber || c.phonenumber || "",
          locationAddress: c.address || "",
          description: prev.description
            ? `${prev.description}\n[MixRadius: ${c.username}]`
            : `[MixRadius: ${c.username}]`,
        }));
        setIsGuest(true);
        toast.success("Data MixRadius berhasil dimuat (Mode Tamu)");
      } else {
        throw new Error("Sync failed");
      }
    } catch (error: unknown) {
      const err = error as Error;
      clientLogger.error("Sync Error:", error);
      toast.error(err.message || "Gagal memuat data MixRadius");
    } finally {
      setSearchingPelanggan(false);
      setSearchQuery("");
      setMixRadiusList([]);
    }
  };

  const handleGuestToggle = () => {
    if (isGuest) {
      // Switching FROM Guest TO Linked
      setFormData((prev) => ({
        ...prev,
        pelangganId: "",
        pelangganDisplay: "",
      }));
      setIsGuest(false);
    } else {
      // Switching FROM Linked TO Guest
      setIsGuest(true);
      setFormData((prev) => ({
        ...prev,
        pelangganId: "",
        pelangganDisplay: "",
      }));
    }
  };

  const applyQuickAction = (action: string) => {
    switch (action) {
      // === CUSTOMER ACTIONS ===
      case "INTERNET_MATI":
        setFormData((prev) => ({
          ...prev,
          title: "Internet Mati / FOCUT",
          description:
            "Internet mati total, kemungkinan kabel putus atau LOS merah.",
          type: "TROUBLESHOOT",
          priority: "HIGH",
          disconnectionReason: "",
        }));
        break;
      case "WIFI_NO_CONNECT":
        setFormData((prev) => ({
          ...prev,
          title: "Tidak Bisa Connect WiFi",
          description:
            "Perangkat tidak bisa terhubung ke WiFi, atau password salah terus.",
          type: "TROUBLESHOOT",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "LAMBAT":
        setFormData((prev) => ({
          ...prev,
          title: "Koneksi Lambat",
          description: "Koneksi internet terasa lambat tidak sesuai paket.",
          type: "TROUBLESHOOT",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "PENARIKAN":
        setFormData((prev) => ({
          ...prev,
          title: "Penarikan Perangkat",
          description:
            "Pengambilan perangkat dari lokasi pelanggan (Modem/Router).",
          type: "DISCONNECTION",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "PASANG_BARU":
        setFormData((prev) => ({
          ...prev,
          title: "Instalasi Baru",
          description: "Pemasangan perangkat baru untuk pelanggan baru.",
          type: "INSTALLATION",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "RELOKASI":
        setFormData((prev) => ({
          ...prev,
          title: "Relokasi Perangkat",
          description:
            "Pemindahan lokasi perangkat di alamat yang sama atau baru.",
          type: "RELOCATION",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      // === FOC INTERNAL ACTIONS ===
      case "SPLICING_FO":
        setFormData((prev) => ({
          ...prev,
          title: "Splicing Fiber Optik",
          description:
            "Penyambungan kabel fiber optik menggunakan fusion splicer.",
          type: "MAINTENANCE",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "PATCHING_ODP":
        setFormData((prev) => ({
          ...prev,
          title: "Patching ODC/ODP",
          description:
            "Pemasangan patch cord pada ODC/ODP untuk koneksi pelanggan baru atau maintenance.",
          type: "MAINTENANCE",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "INSTALASI_KABEL":
        setFormData((prev) => ({
          ...prev,
          title: "Instalasi Kabel Fiber",
          description:
            "Penarikan kabel fiber optik baru untuk ekspansi jaringan atau penggantian.",
          type: "INSTALLATION",
          priority: "NORMAL",
          disconnectionReason: "",
        }));
        break;
      case "INSPEKSI_JALUR":
        setFormData((prev) => ({
          ...prev,
          title: "Inspeksi Jalur Kabel",
          description:
            "Pengecekan jalur kabel, tiang, dan infrastruktur jaringan untuk deteksi masalah potensial.",
          type: "MAINTENANCE",
          priority: "LOW",
          disconnectionReason: "",
        }));
        break;
      case "PERBAIKAN_PUTUS":
        setFormData((prev) => ({
          ...prev,
          title: "Perbaikan Kabel Putus",
          description:
            "Perbaikan darurat kabel fiber yang putus akibat kecelakaan, pohon tumbang, atau faktor lainnya.",
          type: "TROUBLESHOOT",
          priority: "URGENT",
          disconnectionReason: "",
        }));
        break;
      case "MAINTENANCE_TIANG":
        setFormData((prev) => ({
          ...prev,
          title: "Maintenance Tiang/Pole",
          description:
            "Perawatan dan pengecekan kondisi tiang, termasuk klem dan perangkat pendukung.",
          type: "MAINTENANCE",
          priority: "LOW",
          disconnectionReason: "",
        }));
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation based on WO type
    if (woType === "CUSTOMER") {
      // For Customer WO: require customer or guest info
      if (!isGuest && !formData.pelangganId) {
        toast.error("Silakan pilih pelanggan atau gunakan mode Tiket Manual");
        return;
      }
    } else {
      // For Internal WO: require Site and Department
      if (!formData.siteId) {
        toast.error("Pilih Site terlebih dahulu untuk WO Internal");
        return;
      }
      if (!formData.departmentId) {
        toast.error("Pilih Department terlebih dahulu untuk WO Internal");
        return;
      }
    }

    if (!formData.title || !formData.description) {
      toast.error("Silakan isi judul dan deskripsi");
      return;
    }
    if (formData.type === "DISCONNECTION" && !formData.disconnectionReason) {
      toast.error("Silakan pilih alasan pemutusan");
      return;
    }

    setLoading(true);

    // Get department name for Internal WO
    const selectedDepartment = departments.find(
      (d) => d.id === formData.departmentId,
    );
    const selectedSite = sites.find((s) => s.id === formData.siteId);

    // Prepare payload
    const payload = {
      ticketId: formData.ticketId || undefined, // Include ticketId
      pelangganId:
        woType === "INTERNAL" ? null : isGuest ? null : formData.pelangganId,
      siteId: formData.siteId || undefined,
      departmentId: formData.departmentId || undefined,
      type: formData.type,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      isInternal: woType === "INTERNAL", // Flag untuk WO Internal FOC
      locationAddress:
        woType === "INTERNAL"
          ? selectedSite
            ? `Site: ${selectedSite.code} - ${selectedSite.name}`
            : formData.locationAddress
          : formData.locationAddress || undefined,
      contactName:
        woType === "INTERNAL"
          ? selectedDepartment?.name || "Internal Team"
          : formData.contactName || (isGuest ? "Guest" : undefined),
      contactPhone: formData.contactPhone || undefined,
      scheduledDate: formData.scheduledDate
        ? new Date(formData.scheduledDate)
        : undefined,
      scheduledTimeStart: formData.scheduledTimeStart || undefined,
      scheduledTimeEnd: formData.scheduledTimeEnd || undefined,
      disconnectionReason: formData.disconnectionReason || undefined,
      templateId: formData.templateId || undefined,
    };

    try {
      const response = await fetch("/api/admin/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success("Work Order berhasil dibuat!");
        router.push(`/admin/workorders/${result.data.id}`);
      } else {
        const error = await response.json();
        toast.error(
          error.error || "Gagal membuat work order. Silakan coba lagi.",
        );
      }
    } catch (error: unknown) {
      clientLogger.error("Error creating work order:", error);
      toast.error("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading")
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PageLoader />
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/workorders/list"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <HiArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              New Work Order
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Ticket Number will be generated automatically
            </p>
          </div>
        </div>

        <button
          onClick={() => setSimpleMode(!simpleMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${simpleMode ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
        >
          <HiSparkles className="w-4 h-4" />
          {simpleMode ? "Simple Mode ON" : "Simple Mode OFF"}
        </button>
      </div>

      {/* WO Type Toggle: Customer vs Internal */}
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setWoType("CUSTOMER")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            woType === "CUSTOMER"
              ? "bg-white dark:bg-gray-700 text-sky-700 dark:text-sky-300 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          <HiUserCircle className="w-5 h-5" />
          Customer
        </button>
        <button
          type="button"
          onClick={() => setWoType("INTERNAL")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            woType === "INTERNAL"
              ? "bg-white dark:bg-gray-700 text-orange-700 dark:text-orange-300 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          <HiBolt className="w-5 h-5" />
          Internal (FOC)
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Customer Details Section (Only for CUSTOMER type) */}
          {woType === "CUSTOMER" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Customer Details
                </label>

                {/* Toggle hidden in "More" or small text if user wants "Simple" */}
                <button
                  type="button"
                  onClick={handleGuestToggle}
                  className="text-xs text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
                >
                  {isGuest ? (
                    <>
                      <HiMagnifyingGlass className="w-3 h-3" /> Link to Existing
                      Account
                    </>
                  ) : (
                    "Switch to Manual Input"
                  )}
                </button>
              </div>

              {isGuest ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/30 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 text-gray-500 dark:text-gray-400 text-sm">
                      <HiUserCircle className="w-5 h-5" />
                      <span>Ordering as Guest / Manual Ticket</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Nama Pelanggan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.contactName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactName: e.target.value,
                          })
                        }
                        placeholder="Nama Lengkap..."
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-white transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        No. Telp / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactPhone: e.target.value,
                          })
                        }
                        placeholder="Contoh: 0812..."
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Alamat Lengkap <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.locationAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          locationAddress: e.target.value,
                        })
                      }
                      placeholder="Jalan, Nomor Rumah, RT/RW, Kelurahan..."
                      rows={4}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-white transition-all"
                      required
                    />
                  </div>
                </div>
              ) : (
                /* Existing Customer Search Logic */
                <div className="space-y-4">
                  {formData.pelangganId ? (
                    <div className="flex items-center justify-between p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formData.pelangganDisplay}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                          {formData.locationAddress}
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            pelangganId: "",
                            pelangganDisplay: "",
                          })
                        }
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchSource("MIXRADIUS");
                            setSearchQuery("");
                            setPelangganList([]);
                            setMixRadiusList([]);
                          }}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${searchSource === "MIXRADIUS" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                        >
                          <HiCloud className="w-3.5 h-3.5" />
                          MixRadius API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchSource("LOCAL");
                            setSearchQuery("");
                            setPelangganList([]);
                            setMixRadiusList([]);
                          }}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${searchSource === "LOCAL" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                        >
                          Local Database
                        </button>
                      </div>

                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          searchSource === "LOCAL"
                            ? "Search local customer by name or ID..."
                            : "Search user in MixRadius..."
                        }
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                        autoFocus
                      />
                      {searchingPelanggan && (
                        <div className="absolute right-4 top-12">
                          <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}

                      {(pelangganList.length > 0 ||
                        mixRadiusList.length > 0) && (
                        <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {searchSource === "LOCAL"
                            ? pelangganList.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => selectPelanggan(p)}
                                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                                >
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {p.nama}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                                    <span>{p.idPelanggan}</span>
                                    <span>{p.alamat}</span>
                                  </div>
                                </button>
                              ))
                            : mixRadiusList.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => selectMixRadiusCustomer(c)}
                                  className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors group"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                      {c.fullname}
                                    </div>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                      {c.plan_name}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    <span className="font-mono text-xs text-gray-400 mr-2">
                                      {c.member_id}
                                    </span>
                                    {c.address && (
                                      <span className="truncate block">
                                        {c.address.substring(0, 50)}...
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Internal Work Location Section (Only for INTERNAL type) */}
          {woType === "INTERNAL" && (
            <div className="space-y-4 bg-orange-50 dark:bg-orange-900/10 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-4">
                <HiBolt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <label className="block text-sm font-medium text-orange-900 dark:text-orange-100 uppercase tracking-wide">
                  Internal Work Location
                </label>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 -mt-2 mb-4">
                Work order internal untuk pekerjaan FOC (Fiber Optic Cable).
                Pilih Site dan Department yang akan mengerjakan.
              </p>
            </div>
          )}

          {/* Quick Actions (Only in Simple Mode) */}
          {simpleMode && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {woType === "CUSTOMER"
                  ? "Quick Actions (Customer Issues)"
                  : "Quick Actions (FOC Internal)"}
              </label>

              {/* Customer Quick Actions */}
              {woType === "CUSTOMER" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <button
                    type="button"
                    onClick={() => applyQuickAction("INTERNET_MATI")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiWifi className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-red-700 dark:group-hover:text-red-300 text-center">
                      Internet Mati / FOCUT
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("LAMBAT")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiClock className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-orange-700 dark:group-hover:text-orange-300 text-center">
                      Koneksi Lambat
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("PENARIKAN")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiArchiveBoxArrowDown className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white text-center">
                      Penarikan Perangkat
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("PASANG_BARU")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiPlusCircle className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-300 text-center">
                      Pasang Baru
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("RELOKASI")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiMapPin className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300 text-center">
                      Relokasi Perangkat
                    </span>
                  </button>
                </div>
              )}

              {/* FOC Internal Quick Actions */}
              {woType === "INTERNAL" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <button
                    type="button"
                    onClick={() => applyQuickAction("SPLICING_FO")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiBolt className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-orange-700 dark:group-hover:text-orange-300 text-center">
                      Splicing FO
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("PATCHING_ODP")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiSignal className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-700 dark:group-hover:text-purple-300 text-center">
                      Patching ODC/ODP
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("INSTALASI_KABEL")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiPlusCircle className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-300 text-center">
                      Instalasi Kabel
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("INSPEKSI_JALUR")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiEye className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-sky-700 dark:group-hover:text-sky-300 text-center">
                      Inspeksi Jalur
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("PERBAIKAN_PUTUS")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiExclamationTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-red-700 dark:group-hover:text-red-300 text-center">
                      Perbaikan Putus
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickAction("MAINTENANCE_TIANG")}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HiWrenchScrewdriver className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white text-center">
                      Maintenance Tiang
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Site Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Site / Area{" "}
              {woType === "INTERNAL" && <span className="text-red-500">*</span>}
            </label>
            <select
              value={formData.siteId}
              onChange={(e) =>
                setFormData({ ...formData, siteId: e.target.value })
              }
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow ${
                woType === "INTERNAL"
                  ? "border-orange-300 dark:border-orange-600"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              required={woType === "INTERNAL"}
            >
              <option value="">
                {woType === "INTERNAL"
                  ? "Pilih Site (wajib untuk Internal)"
                  : "Select Site (optional)"}
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {woType === "INTERNAL"
                ? "Site wajib dipilih untuk WO Internal - menentukan lokasi pekerjaan"
                : "Work order will be available to employees assigned to this site"}
            </p>
          </div>

          {/* Department Selection - Required for notifications */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.departmentId}
              onChange={(e) =>
                setFormData({ ...formData, departmentId: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
              required
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Semua employee di department ini akan menerima notifikasi work
              order baru
            </p>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Koneksi Lambat"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description..."
                rows={5}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                required
              />
            </div>
          </div>

          {/* Disconnection Reason Dropdown */}
          {(formData.type === "DISCONNECTION" ||
            formData.title.includes("Penarikan Perangkat")) && (
            <div className="space-y-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <label className="block text-sm font-medium text-red-900 dark:text-red-100">
                Alasan Penarikan <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.disconnectionReason}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    disconnectionReason: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-red-300 dark:border-red-700 rounded-lg focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                required={formData.type === "DISCONNECTION"}
              >
                <option value="">Pilih Alasan...</option>
                <option value="Telat Bayar">Telat Bayar</option>
                <option value="Pindah Rumah">Pindah Rumah</option>
                <option value="Pindah ke Provider Lain">
                  Pindah ke Provider Lain
                </option>
                <option value="Sering Gangguan">Sering Gangguan</option>
                <option value="Pelayanan Pelanggan Buruk">
                  Pelayanan Pelanggan Buruk
                </option>
                <option value="Kebutuhan Menurun">Kebutuhan Menurun</option>
                <option value="Harga Terlalu Mahal">Harga Terlalu Mahal</option>
                <option value="Kecepatan Tidak Sesuai Janji">
                  Kecepatan Tidak Sesuai Janji
                </option>
                <option value="Tidak Ada Keterangan">
                  Tidak Ada Keterangan
                </option>
              </select>
            </div>
          )}

          {/* Detailed Actions (Hidden in Simple Mode) */}
          <div
            className={`space-y-6 pt-6 border-t border-gray-100 dark:border-gray-700 ${simpleMode ? "hidden" : "block"}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="INSTALLATION">Installation</option>
                  <option value="TROUBLESHOOT">Troubleshoot</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UPGRADE">Upgrade</option>
                  <option value="RELOCATION">Relocation</option>
                  <option value="DISCONNECTION">Disconnection</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Link
              href="/admin/workorders/list"
              className="flex-1 px-6 py-3.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-center font-medium transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="flex-2"
            >
              Create Work Order
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
