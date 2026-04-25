"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import {
  getWithAuth,
  postWithAuth,
  patchWithAuth,
  putWithAuth,
  deleteWithAuth,
} from "@/lib/api-client";
import type {
  PhotoUploadRef,
  UploadedPhoto,
} from "@/components/inventory/PhotoUpload";

import {
  buildInitialReceivedItems,
  canSubmitRestockForm,
  getFilteredBarangs,
  getPaginatedRestockRequests,
  getRestockFilterOptions,
  getVisibleRestockRequests,
} from "./utils";
import type {
  Barang,
  Gudang,
  PurchaseRequest,
  RestockFormItem,
  RestockSetting,
} from "./types";

const INITIAL_FORM_ITEM: RestockFormItem = {
  barangId: "",
  quantity: 1,
  keterangan: "",
};

export function useRestockPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [barangs, setBarangs] = useState<Barang[]>([]);
  const [allBarangsSource, setAllBarangsSource] = useState<Barang[]>([]);
  const [allSettingsSource, setAllSettingsSource] = useState<RestockSetting[]>(
    [],
  );
  const [gudangs, setGudangs] = useState<Gudang[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    PurchaseRequest["status"] | "all"
  >("all");
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
  const [receivingPR, setReceivingPR] = useState<PurchaseRequest | null>(null);
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>(
    {},
  );
  const [receivedPhotos, setReceivedPhotos] = useState<UploadedPhoto[]>([]);
  const [isFinishingPO, setIsFinishingPO] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const photoUploadRef = useRef<PhotoUploadRef>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRequests, resBarangs, resGudangs, resSettings] =
        await Promise.all([
          getWithAuth("/api/inventory/restock/requests"),
          getWithAuth("/api/inventory/barang?view=all&limit=1000"),
          getWithAuth("/api/inventory/gudang?view=all"),
          getWithAuth("/api/inventory/restock/settings?limit=1000"),
        ]);

      if (resRequests.ok) {
        const data = await resRequests.json();
        setRequests(data.data || []);
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
    } catch (_error) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
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

  useEffect(() => {
    setBarangs(filteredBarangs);
  }, [filteredBarangs]);

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

  const statusOptions = useMemo(
    () => getRestockFilterOptions(requests),
    [requests],
  );

  const gudangOptions = useMemo(
    () => [
      { value: "all", label: "Semua Gudang" },
      ...gudangs.map((gudang) => ({ value: gudang.id, label: gudang.nama })),
    ],
    [gudangs],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, gudangFilter, itemsPerPage]);

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
    setFormItems(
      request.items.map((item) => ({
        barangId: item.barangId,
        quantity: item.jumlah,
        keterangan: item.keterangan || "",
      })),
    );
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const saveRequest = useCallback(async () => {
    if (
      !canSubmitRestockForm({ formGudang, formItems, isSubmitting: submitting })
    ) {
      toast.error("Harap lengkapi data barang dan gudang");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        gudangId: formGudang,
        keterangan: formNotes,
        items: formItems,
      };
      const response = editingPR
        ? await putWithAuth(
            `/api/inventory/restock/requests/${editingPR.id}`,
            payload,
          )
        : await postWithAuth("/api/inventory/restock/requests", payload);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal menyimpan data");
      }

      toast.success(
        editingPR ? "Pengajuan diperbarui" : "Pengajuan berhasil dibuat",
      );
      setShowForm(false);
      await fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }, [editingPR, fetchData, formGudang, formItems, formNotes, submitting]);

  const deleteRequest = useCallback(
    async (id: string) => {
      if (!confirm("Yakin ingin menghapus pengajuan ini?")) return;

      try {
        const response = await deleteWithAuth(
          `/api/inventory/restock/requests/${id}`,
        );
        if (response.ok) {
          toast.success("Pengajuan dihapus");
          await fetchData();
        }
      } catch (_error) {
        toast.error("Gagal menghapus");
      }
    },
    [fetchData],
  );

  const approveRequest = useCallback(
    async (id: string) => {
      try {
        const response = await patchWithAuth(
          `/api/inventory/restock/requests/${id}`,
          { action: "APPROVE" },
        );
        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Gagal menyetujui");
          return;
        }

        toast.success("Pengajuan disetujui");
        await fetchData();
      } catch (_error) {
        toast.error("Terjadi kesalahan");
      }
    },
    [fetchData],
  );

  const openReceive = useCallback((request: PurchaseRequest) => {
    setReceivingPR(request);
    setReceivedItems(buildInitialReceivedItems(request));
    setReceivedPhotos([]);
    setIsFinishingPO(true);
  }, []);

  const closeReceive = useCallback(() => {
    setReceivingPR(null);
  }, []);

  const submitReceipt = useCallback(async () => {
    if (!receivingPR) return;
    if (receivedPhotos.length === 0) {
      toast.error("Foto bukti penerimaan barang wajib diunggah");
      return;
    }

    try {
      setSubmitting(true);
      let photoUrls: string[] = [];

      if (photoUploadRef.current) {
        const loadingToastId = toast.loading("Sedang mengunggah foto...");
        photoUrls = await photoUploadRef.current.uploadPhotos();
        toast.dismiss(loadingToastId);
      }

      const response = await patchWithAuth(
        `/api/inventory/restock/requests/${receivingPR.id}/receive`,
        {
          items: receivedItems,
          fotoBukti: photoUrls,
          closePO: isFinishingPO,
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal memproses");
      }

      toast.success("Barang berhasil diterima & stok bertambah");
      setReceivingPR(null);
      await fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }, [
    fetchData,
    isFinishingPO,
    receivedItems,
    receivedPhotos.length,
    receivingPR,
  ]);

  return {
    requests: paginatedRequests.data,
    barangs,
    allSettingsSource,
    gudangs,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusOptions,
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
    receivingPR,
    receivedItems,
    setReceivedItems,
    receivedPhotos,
    setReceivedPhotos,
    isFinishingPO,
    setIsFinishingPO,
    submitting,
    photoUploadRef,
    openCreate,
    openEdit,
    closeForm,
    saveRequest,
    deleteRequest,
    approveRequest,
    openReceive,
    closeReceive,
    submitReceipt,
  };
}
