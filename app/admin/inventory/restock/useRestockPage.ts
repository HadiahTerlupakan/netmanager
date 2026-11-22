"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-hot-toast";

import {
  getWithAuth,
  postWithAuth,
  patchWithAuth,
  putWithAuth,
  deleteWithAuth,
} from "@/lib/api-client";
import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";

import {
  describeRestockClientError,
  getFilteredBarangs,
  getPaginatedRestockRequests,
  getPendingJasaItems,
  getRestockFormProblems,
  getVisibleRestockRequests,
  readRestockErrorMessage,
  RESTOCK_STATUS_FILTER_OPTIONS,
  type RestockStatusFilter,
  uploadProofPhotos,
} from "./utils";
import type {
  Barang,
  Gudang,
  Jasa,
  PurchaseRequest,
  RestockFormItem,
  RestockSetting,
} from "./types";
import type { JasaConfirmState } from "./RestockConfirmJasaModal";
import { showRestockError } from "./restockToasts";
import { useRestockApproval } from "./useRestockApproval";
import { useRestockCancel } from "./useRestockCancel";
import { useRestockEntry } from "./useRestockEntry";

const INITIAL_FORM_ITEM: RestockFormItem = {
  tipe: "BARANG",
  barangId: "",
  quantity: 1,
  keterangan: "",
};

/**
 * State halaman Pengajuan Barang: daftar dan filternya, form pengajuan,
 * konfirmasi jasa, serta pengendali modal persetujuan, Lapor Barang Sampai, dan
 * Batalkan Pengajuan.
 */
export function useRestockPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [allBarangsSource, setAllBarangsSource] = useState<Barang[]>([]);
  const [allJasaSource, setAllJasaSource] = useState<Jasa[]>([]);
  const [allSettingsSource, setAllSettingsSource] = useState<RestockSetting[]>(
    [],
  );
  const [gudangs, setGudangs] = useState<Gudang[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RestockStatusFilter>("all");
  const [gudangFilter, setGudangFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPR, setEditingPR] = useState<PurchaseRequest | null>(null);
  const [formGudang, setFormGudang] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<RestockFormItem[]>([
    INITIAL_FORM_ITEM,
  ]);
  const [viewingPR, setViewingPR] = useState<PurchaseRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmJasaPR, setConfirmJasaPR] = useState<PurchaseRequest | null>(
    null,
  );
  const [jasaConfirmStates, setJasaConfirmStates] = useState<
    Record<string, JasaConfirmState>
  >({});
  const [jasaPhotoUploadRefs, setJasaPhotoUploadRefs] = useState<
    Record<string, React.RefObject<PhotoUploadRef | null>>
  >({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRequests, resBarangs, resGudangs, resSettings, resJasa] =
        await Promise.all([
          getWithAuth("/api/inventory/restock/requests"),
          getWithAuth("/api/inventory/barang?view=all&limit=1000"),
          getWithAuth("/api/inventory/gudang?view=all"),
          getWithAuth("/api/inventory/restock/settings?limit=1000"),
          getWithAuth("/api/inventory/jasa?limit=1000"),
        ]);

      if (resRequests.ok) {
        const data = await resRequests.json();
        const fresh: PurchaseRequest[] = data.data || [];
        setRequests(fresh);
        // Detail yang sedang terbuka ikut diperbarui dengan data terbaru.
        setViewingPR((current) =>
          current
            ? (fresh.find((request) => request.id === current.id) ?? current)
            : current,
        );
      }

      if (resBarangs.ok) {
        const data = await resBarangs.json();
        setAllBarangsSource(data.data?.barangs || data.barangs || []);
      }

      if (resSettings.ok) {
        const data = await resSettings.json();
        const rawSettings =
          data.data?.settings || data.settings || data.data || [];
        setAllSettingsSource(Array.isArray(rawSettings) ? rawSettings : []);
      }

      if (resGudangs.ok) {
        const data = await resGudangs.json();
        const result = data.data || data;
        setGudangs(result.gudangs || []);
      }

      if (resJasa.ok) {
        const data = await resJasa.json();
        const items = data.data?.items || data.items || [];
        setAllJasaSource(Array.isArray(items) ? items : []);
      }
    } catch (_error) {
      showRestockError(
        "Data pengajuan restock gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  const filteredBarangs = useMemo(
    () =>
      getFilteredBarangs({
        allBarangs: allBarangsSource,
        allSettings: allSettingsSource,
        formGudang,
        showAllItems,
      }),
    [allBarangsSource, allSettingsSource, formGudang, showAllItems],
  );

  const barangs = filteredBarangs;

  const visibleRequests = useMemo(
    () =>
      getVisibleRestockRequests({
        requests,
        search,
        statusFilter,
        gudangFilter,
      }),
    [gudangFilter, requests, search, statusFilter],
  );

  const paginatedRequests = useMemo(
    () =>
      getPaginatedRestockRequests({
        requests: visibleRequests,
        page: currentPage,
        itemsPerPage,
      }),
    [currentPage, itemsPerPage, visibleRequests],
  );

  const gudangOptions = useMemo(
    () => [
      { value: "all", label: "Semua Gudang" },
      ...gudangs.map((gudang) => ({ value: gudang.id, label: gudang.nama })),
    ],
    [gudangs],
  );

  const [prevFilterKey, setPrevFilterKey] = useState<string>(
    `${search}|${statusFilter}|${gudangFilter}|${itemsPerPage}`,
  );
  const filterKey = `${search}|${statusFilter}|${gudangFilter}|${itemsPerPage}`;
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const resetForm = useCallback(
    (gudangId = gudangs[0]?.id || "") => {
      setFormGudang(gudangId);
      setFormNotes("");
      setFormItems([INITIAL_FORM_ITEM]);
      setShowAllItems(false);
    },
    [gudangs],
  );

  const openCreate = useCallback(() => {
    setEditingPR(null);
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const openEdit = useCallback((request: PurchaseRequest) => {
    setEditingPR(request);
    setFormGudang(request.gudangId);
    setFormNotes(request.keterangan || "");
    const barangItems: RestockFormItem[] = request.items.map((item) => ({
      tipe: "BARANG",
      barangId: item.barangId,
      quantity: item.jumlah,
      keterangan: item.keterangan || "",
    }));
    const jasaItems: RestockFormItem[] = (request.jasaItems || []).map(
      (item) => ({
        tipe: "JASA",
        barangId: "",
        jasaId: item.jasaId,
        quantity: item.jumlah,
        keterangan: item.keterangan || "",
      }),
    );
    setFormItems([...barangItems, ...jasaItems]);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const saveRequest = useCallback(async () => {
    if (submitting) return;
    const problems = getRestockFormProblems({
      formGudang,
      formNotes,
      formItems,
      barangNamaById: new Map(
        allBarangsSource.map((barang) => [barang.id, barang.nama]),
      ),
    });
    if (problems.length > 0) {
      showRestockError(
        `Pengajuan belum bisa disimpan:\n${problems.join("\n")}`,
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        gudangId: formGudang,
        keterangan: formNotes,
        items: formItems
          .filter((item) => item.tipe === "BARANG")
          .map((item) => ({
            barangId: item.barangId,
            quantity: item.quantity,
            keterangan: item.keterangan || null,
          })),
        jasaItems: formItems
          .filter((item) => item.tipe === "JASA")
          .map((item) => ({
            jasaId: item.jasaId,
            jumlah: item.quantity,
            keterangan: item.keterangan || null,
          })),
      };
      const response = editingPR
        ? await putWithAuth(
            `/api/inventory/restock/requests/${editingPR.id}`,
            payload,
          )
        : await postWithAuth("/api/inventory/restock/requests", payload);

      if (!response.ok) {
        throw new Error(
          await readRestockErrorMessage(
            response,
            "Pengajuan belum tersimpan. Coba sekali lagi.",
          ),
        );
      }

      toast.success(
        editingPR ? "Pengajuan diperbarui" : "Pengajuan berhasil dibuat",
      );
      setShowForm(false);
      await fetchData();
    } catch (error: unknown) {
      showRestockError(describeRestockClientError(error));
    } finally {
      setSubmitting(false);
    }
  }, [
    allBarangsSource,
    editingPR,
    fetchData,
    formGudang,
    formItems,
    formNotes,
    submitting,
  ]);

  const deleteRequest = useCallback(
    async (id: string) => {
      if (!confirm("Yakin ingin menghapus pengajuan ini?")) return;

      try {
        const response = await deleteWithAuth(
          `/api/inventory/restock/requests/${id}`,
        );
        if (!response.ok) {
          showRestockError(
            await readRestockErrorMessage(
              response,
              "Pengajuan belum terhapus. Coba sekali lagi.",
            ),
          );
          return;
        }
        toast.success("Pengajuan dihapus");
        await fetchData();
      } catch (error: unknown) {
        showRestockError(describeRestockClientError(error));
      }
    },
    [fetchData],
  );

  const openConfirmJasa = useCallback((request: PurchaseRequest) => {
    const pending = getPendingJasaItems(request);
    if (pending.length === 0) {
      showRestockError("Semua jasa di pengajuan ini sudah ditandai selesai.");
      return;
    }
    setConfirmJasaPR(request);
    const states: Record<string, JasaConfirmState> = {};
    const refs: Record<string, React.RefObject<PhotoUploadRef | null>> = {};
    for (const item of pending) {
      states[item.id] = {
        tanggalSelesai: "",
        buktiSelesai: [],
        confirmed: true,
      };
      refs[item.id] = React.createRef<PhotoUploadRef | null>();
    }
    setJasaConfirmStates(states);
    setJasaPhotoUploadRefs(refs);
  }, []);

  const closeConfirmJasa = useCallback(() => {
    setConfirmJasaPR(null);
    setJasaConfirmStates({});
    setJasaPhotoUploadRefs({});
  }, []);

  const updateJasaConfirmState = useCallback(
    (jasaItemId: string, next: Partial<JasaConfirmState>) => {
      setJasaConfirmStates((prev) => {
        const current = prev[jasaItemId] ?? {
          tanggalSelesai: "",
          buktiSelesai: [],
          confirmed: false,
        };
        const merged: JasaConfirmState = {
          tanggalSelesai:
            next.tanggalSelesai !== undefined
              ? next.tanggalSelesai
              : current.tanggalSelesai,
          buktiSelesai:
            next.buktiSelesai !== undefined
              ? next.buktiSelesai
              : current.buktiSelesai,
          confirmed:
            next.confirmed !== undefined ? next.confirmed : current.confirmed,
        };
        return { ...prev, [jasaItemId]: merged };
      });
    },
    [],
  );

  const submitConfirmJasa = useCallback(async () => {
    if (!confirmJasaPR) return;
    const pending = getPendingJasaItems(confirmJasaPR);
    const ready = pending.filter((item) => {
      const state = jasaConfirmStates[item.id];
      return state?.confirmed && (state.buktiSelesai?.length ?? 0) > 0;
    });

    if (ready.length === 0) {
      showRestockError(
        "Belum ada jasa yang siap. Centang jasa yang sudah selesai, lalu unggah fotonya dulu.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const uploadedPayload = [];
      for (const item of ready) {
        const state = jasaConfirmStates[item.id];
        const urls = await uploadProofPhotos(jasaPhotoUploadRefs[item.id]);
        uploadedPayload.push({
          jasaItemId: item.id,
          tanggalSelesai: state?.tanggalSelesai || null,
          buktiSelesai: urls,
        });
      }

      const response = await patchWithAuth(
        `/api/inventory/restock/requests/${confirmJasaPR.id}/receive-jasa`,
        { items: uploadedPayload },
      );

      if (!response.ok) {
        throw new Error(
          await readRestockErrorMessage(
            response,
            "Jasa belum ditandai selesai. Coba sekali lagi.",
          ),
        );
      }

      toast.success("Jasa berhasil dikonfirmasi selesai");
      closeConfirmJasa();
      await fetchData();
    } catch (error: unknown) {
      showRestockError(describeRestockClientError(error));
    } finally {
      setSubmitting(false);
    }
  }, [
    closeConfirmJasa,
    confirmJasaPR,
    fetchData,
    jasaConfirmStates,
    jasaPhotoUploadRefs,
  ]);

  // Dipanggil setelah semua useState di atas supaya urutan hook halaman tetap.
  const approval = useRestockApproval({
    fetchData,
    allBarangs: allBarangsSource,
  });
  const entry = useRestockEntry({ fetchData, barangs: allBarangsSource });
  const cancel = useRestockCancel({ fetchData });

  return {
    requests: paginatedRequests.data,
    barangs,
    allBarangs: allBarangsSource,
    allJasaSource,
    allSettingsSource,
    gudangs,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusOptions: RESTOCK_STATUS_FILTER_OPTIONS,
    gudangFilter,
    setGudangFilter,
    gudangOptions,
    currentPage: paginatedRequests.page,
    totalPages: paginatedRequests.totalPages,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    showAllItems,
    setShowAllItems,
    showForm,
    editingPR,
    formGudang,
    setFormGudang,
    formNotes,
    setFormNotes,
    formItems,
    setFormItems,
    viewingPR,
    setViewingPR,
    submitting,
    openCreate,
    openEdit,
    closeForm,
    saveRequest,
    deleteRequest,
    approval,
    entry,
    cancel,
    confirmJasaPR,
    openConfirmJasa,
    closeConfirmJasa,
    jasaConfirmStates,
    updateJasaConfirmState,
    jasaPhotoUploadRefs,
    submitConfirmJasa,
  };
}
