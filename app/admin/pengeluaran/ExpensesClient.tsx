"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type SubmitEvent,
} from "react";
import {
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineBuildingOffice,
  HiOutlineTag,
  HiOutlineDocumentArrowDown,
  HiOutlineClipboardDocumentList,
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  HiOutlinePaperClip,
  HiOutlineXMark,
  HiOutlineReceiptPercent,
} from "react-icons/hi2";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { Modal, ModalBody } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { formatCurrency } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import { buildDailyExpenseIndicators } from "@/modules/finance/client";
import { useApi } from "@/lib/hooks/useApi";
import { buildExpenseCsvContent } from "./expense-csv";
import {
  buildExpenseIdempotencyKey,
  buildHierarchicalCategoryOptions,
  createDefaultExpenseFormData,
  createDefaultExpenseItem,
  filterCategoryOptionsByType,
  mapExpenseToFormState,
} from "./expenses.helpers";
import type { SiteOption } from "./expenses.types";
import RABList from "./RABList";
import type { RABProject } from "./rabTypes";
import RABForm from "./RABForm";
import RABRevisionForm from "./RABRevisionForm";
import RABView from "./RABView";
import CategoryList from "./CategoryList";

interface FormItem {
  amount: string;
  description: string;
  rabItemId: string;
}

interface Expense {
  id: string;
  date: string;
  amount: string;
  category: string; // CAPEX/OPEX
  expenseCategoryId?: string;
  expenseCategory?: {
    id: string;
    name: string;
    type: string;
  };
  categoryId?: string; // COA Category
  transactionCategory?: {
    id: string;
    name: string;
  };
  accountId?: string; // Financial Account
  financialAccount?: {
    id: string;
    name: string;
    balance: number;
  };
  depreciation?: string;
  usefulLife?: number;
  description?: string;
  siteId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  site?: {
    id: string;
    name: string;
  };
  user?: {
    name: string;
  };
  rabProject?: {
    id: string;
    name: string;
  };
  rabItem?: {
    id: string;
    name: string;
  };
}

interface FormItem {
  id?: string;
  amount: string;
  description: string;
  rabProjectId: string;
  rabItemId: string;
  category?: string; // Removed category from per-item since user requested it to be global
  expenseCategoryId: string;
  isUsefulLifeEnabled: boolean;
  usefulLife: number;
  depreciation: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  _count?: { children: number };
}

interface RabBottleneckMetrics {
  pendingApprovalCount: number;
  oldestPendingDays: number;
  oldestPendingProjectName: string | null;
  averageApprovalLeadHours: number;
}

export default function ExpensesClient() {
  const { hasPermission } = usePermission();

  const canCreate = hasPermission("expense:create");
  const canUpdate = hasPermission("expense:update");
  const canDelete = hasPermission("expense:delete");

  const [data, setData] = useState<Expense[]>([]);
  const [_error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");

  // Options - migrated to useApi
  // const [coaCategories, setCoaCategories] = useState<CategoryOption[]>([]) // Deprecated
  // const [accounts, setAccounts] = useState<AccountOption[]>([]) // Deprecated

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [items, setItems] = useState<FormItem[]>([createDefaultExpenseItem()]);
  const [formData, setFormData] = useState(createDefaultExpenseFormData);

  const [, setIsUsefulLifeEnabled] = useState(false);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // RAB State
  const [activeTab, setActiveTab] = useState<"daily" | "rab" | "coa">("daily");
  const [isRABModalOpen, setIsRABModalOpen] = useState(false);
  const [editingRAB, setEditingRAB] = useState<RABProject | null>(null);
  const [isRABViewOpen, setIsRABViewOpen] = useState(false);
  const [viewingRAB, setViewingRAB] = useState<RABProject | null>(null);
  const [isRABRevisionModalOpen, setIsRABRevisionModalOpen] = useState(false);
  const [revisioningRAB, setRevisioningRAB] = useState<RABProject | null>(null);
  const [rabRefreshKey, setRabRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDailySimpleMode, setIsDailySimpleMode] = useState(true);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  // Pagination State - reset trigger derived from filters via prevFilters comparator
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(20);

  const filterSignature = `${debouncedSearch}|${selectedSite}|${selectedCategory}|${selectedSubCategory}|${startDate}|${endDate}`;
  const [prevFilterSignature, setPrevFilterSignature] =
    useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // Fetch options via TanStack Query.
  // useApi sudah unwrap envelope { success, data } via fetchWithHandling,
  // jadi tipe generic langsung diset ke shape data array dari payload.
  // Site sengaja tidak dari /api/admin/sites: endpoint itu menuntut site:read,
  // padahal pemegang expense:* belum tentu punya. /api/sites cukup login dan
  // membatasi pilihan ke site user bila role memegang expense:site_only.
  const { data: sitesResp } = useApi<{ sites?: SiteOption[] }>(
    "/api/sites?resource=expense",
  );
  const sites: SiteOption[] = useMemo(
    () => (sitesResp?.sites ?? []).map((s) => ({ id: s.id, name: s.name })),
    [sitesResp],
  );

  // Akun kas/bank sumber dana. Nilainya menentukan apakah pengeluaran
  // menghasilkan jurnal: event EXPENSE_APPROVED hanya dikirim bila akun terisi,
  // dan sisi kredit jurnal diambil dari tautan COA akun tersebut.
  const { data: accountsResp } = useApi<
    Array<{ id: string; name: string; type: string }>
  >("/api/finance/accounts");
  const cashAccounts = useMemo(
    () => (Array.isArray(accountsResp) ? accountsResp : []),
    [accountsResp],
  );

  // Filter Categories: depend on selectedCategory
  const { data: filterCategoriesResp } = useApi<CategoryOption[]>(
    selectedCategory
      ? `/api/finance/expense-categories?type=${selectedCategory}`
      : null,
  );
  const filterCategories: CategoryOption[] = useMemo(
    () => (Array.isArray(filterCategoriesResp) ? filterCategoriesResp : []),
    [filterCategoriesResp],
  );

  // Reset selectedSubCategory bila selectedCategory berubah (derived comparator)
  const [prevSelectedCategory, setPrevSelectedCategory] =
    useState(selectedCategory);
  if (prevSelectedCategory !== selectedCategory) {
    setPrevSelectedCategory(selectedCategory);
    setSelectedSubCategory("");
  }

  // Categories for modal: only fetch when modal open
  const { data: categoriesResp, isLoading: isLoadingCategories } = useApi<
    CategoryOption[]
  >(isModalOpen ? "/api/finance/expense-categories" : null);
  const categories: CategoryOption[] = useMemo(
    () => (Array.isArray(categoriesResp) ? categoriesResp : []),
    [categoriesResp],
  );

  // RAB Projects
  const rabProjectsKey = rabRefreshKey
    ? `/api/finance/rab-projects?refreshKey=${rabRefreshKey}`
    : "/api/finance/rab-projects";
  const { data: rabProjectsResp, mutate: refetchRabProjects } =
    useApi<RABProject[]>(rabProjectsKey);
  const rabProjects: RABProject[] = useMemo(
    () => (Array.isArray(rabProjectsResp) ? rabProjectsResp : []),
    [rabProjectsResp],
  );

  // RAB Bottleneck Metrics: only when activeTab === "rab"
  const { data: rabMetricsResp, isLoading: isLoadingRabMetrics } =
    useApi<RabBottleneckMetrics>(
      activeTab === "rab" ? "/api/finance/rab-projects/dashboard" : null,
    );
  const rabBottleneckMetrics: RabBottleneckMetrics | null =
    rabMetricsResp ?? null;

  // Build expenses fetch URL
  const expensesUrl = useMemo(() => {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (selectedSite) params.append("siteId", selectedSite);
    if (selectedCategory) params.append("category", selectedCategory);
    if (selectedSubCategory)
      params.append("expenseCategoryId", selectedSubCategory);
    return `/api/finance/expenses?${params}`;
  }, [startDate, endDate, selectedSite, selectedCategory, selectedSubCategory]);

  const {
    data: expensesResp,
    isLoading: loading,
    error: expensesErr,
    mutate: refetchExpenses,
  } = useApi<unknown>(expensesUrl);

  // Sync data dari SWR ke local data state via prop comparator
  const newData: Expense[] = useMemo(() => {
    if (!expensesResp) return [];
    return Array.isArray(expensesResp)
      ? (expensesResp as Expense[])
      : (((expensesResp as { data?: Expense[] }).data ?? []) as Expense[]);
  }, [expensesResp]);

  // Mirror newData ke setData (untuk error state lokal & toast)
  const [prevExpensesRef, setPrevExpensesRef] = useState<Expense[] | null>(
    null,
  );
  if (prevExpensesRef !== newData) {
    setPrevExpensesRef(newData);
    setData(newData);
    setError(null);
  }

  // Show toast on error
  const [prevErr, setPrevErr] = useState<typeof expensesErr>(undefined);
  if (prevErr !== expensesErr) {
    setPrevErr(expensesErr);
    if (expensesErr) {
      const errorMsg =
        expensesErr.message || "Gagal mengambil data pengeluaran";
      setError(errorMsg);
      toast.error(errorMsg);
    }
  }

  const fetchData = useCallback(() => {
    void refetchExpenses();
  }, [refetchExpenses]);

  const fetchRabProjects = useCallback(() => {
    void refetchRabProjects();
  }, [refetchRabProjects]);
  void fetchRabProjects;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Helper: update specific item in items array
  const updateItem = (index: number, field: keyof FormItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createDefaultExpenseItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Compute total from all items
  const formTotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [items],
  );

  // Invoice upload handler
  const handleInvoiceUpload = async (file: File) => {
    setIsUploadingInvoice(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("folder", "invoices");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });
      if (!res.ok) throw new Error("Upload gagal");
      const result = await res.json();
      setFormData((prev) => ({ ...prev, invoiceFile: result.url }));
      toast.success("Invoice berhasil diupload");
    } catch {
      toast.error("Gagal mengupload invoice");
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  const hierarchicalCategoryOptions = useMemo(
    () => buildHierarchicalCategoryOptions(categories),
    [categories],
  );

  const opexCategoryOptions = useMemo(
    () =>
      filterCategoryOptionsByType(
        hierarchicalCategoryOptions,
        categories,
        "OPEX",
      ),
    [hierarchicalCategoryOptions, categories],
  );

  const capexCategoryOptions = useMemo(
    () =>
      filterCategoryOptionsByType(
        hierarchicalCategoryOptions,
        categories,
        "CAPEX",
      ),
    [hierarchicalCategoryOptions, categories],
  );

  const filteredData = data.filter((item) => {
    if (!debouncedSearch) return true;
    const lowerSearch = debouncedSearch.toLowerCase();
    return (
      (item.description &&
        item.description.toLowerCase().includes(lowerSearch)) ||
      item.amount.toString().includes(lowerSearch) ||
      (item.expenseCategory &&
        item.expenseCategory.name.toLowerCase().includes(lowerSearch))
    );
  });

  // Reset pagination when filters change — handled by filterSignature comparator above

  // Compute paginated data
  const totalPages =
    itemsPerPage === "all" ? 1 : Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    if (itemsPerPage === "all") return filteredData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const selectedFilteredCount = useMemo(
    () =>
      paginatedData.filter((item) => selectedExpenseIds.includes(item.id))
        .length,
    [paginatedData, selectedExpenseIds],
  );

  const allFilteredSelected =
    paginatedData.length > 0 && selectedFilteredCount === paginatedData.length;

  const toggleExpenseSelection = useCallback((id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id)
        ? prev.filter((existingId) => existingId !== id)
        : [...prev, id],
    );
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    const paginatedIds = paginatedData.map((item) => item.id);
    if (paginatedIds.length === 0) return;

    setSelectedExpenseIds((prev) => {
      const allSelected = paginatedIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !paginatedIds.includes(id));
      }

      const merged = new Set([...prev, ...paginatedIds]);
      return Array.from(merged);
    });
  }, [paginatedData]);

  // Hapus selected ids yang sudah tidak ada di data (derived comparator)
  const [prevDataRef, setPrevDataRef] = useState<Expense[]>(data);
  if (prevDataRef !== data) {
    setPrevDataRef(data);
    setSelectedExpenseIds((prev) =>
      prev.filter((id) => data.some((item) => item.id === id)),
    );
  }

  const totalAmount = filteredData.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const totalCapex = filteredData
    .filter((i) => i.category === "CAPEX")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalOpex = filteredData
    .filter((i) => i.category === "OPEX")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const dailyIndicators = useMemo(
    () =>
      buildDailyExpenseIndicators(
        filteredData.map((item) => ({
          date: item.date,
          amount: item.amount,
          category: item.category,
          siteId: item.siteId ?? null,
          description: item.description ?? null,
          invoiceNumber: item.invoiceNumber ?? null,
          invoiceFile: item.invoiceFile ?? null,
        })),
      ),
    [filteredData],
  );

  const handleOpenModal = (item?: Expense) => {
    setStep(1);
    if (item) {
      const editState = mapExpenseToFormState(item);
      setEditingItem(item);
      setIsUsefulLifeEnabled((item.usefulLife || 0) > 0);
      setItems(editState.items);
      setFormData(editState.formData);
    } else {
      setEditingItem(null);
      setIsUsefulLifeEnabled(false);
      setItems([createDefaultExpenseItem()]);
      setFormData(createDefaultExpenseFormData());
    }
    setIsModalOpen(true);
  };

  const nextStep = () => {
    if (step === 1) {
      // Validate all items have amount > 0
      for (let i = 0; i < items.length; i++) {
        if (!items[i].amount || parseFloat(items[i].amount) <= 0) {
          toast.error(`Nominal item ${i + 1} harus lebih besar dari 0`);
          return;
        }
      }
      if (!formData.date) {
        toast.error("Tanggal transaksi wajib diisi");
        return;
      }
    } else if (step === 2) {
      for (let i = 0; i < items.length; i++) {
        if (!items[i].expenseCategoryId) {
          toast.error(
            `Kategori Pengeluaran (COA) untuk item ke-${i + 1} wajib dipilih`,
          );
          return;
        }
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingItem) {
        // Edit mode: always single item
        const item = items[0];
        const payload = {
          ...formData,
          expenseCategoryId: item.expenseCategoryId,
          amount: Number(item.amount),
          description: item.description,
          rabProjectId: item.rabProjectId,
          rabItemId: item.rabItemId,
          usefulLife:
            formData.category === "OPEX" || !item.isUsefulLifeEnabled
              ? 0
              : item.usefulLife,
          depreciation: item.depreciation || "0",
        };

        const res = await fetch(`/api/finance/expenses/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || "Gagal memperbarui data pengeluaran",
          );
        }

        toast.success("Data berhasil diperbarui");
      } else if (items.length === 1) {
        // Create single item
        const item = items[0];
        const payload = {
          ...formData,
          expenseCategoryId: item.expenseCategoryId,
          amount: Number(item.amount),
          description: item.description,
          rabProjectId: item.rabProjectId,
          rabItemId: item.rabItemId,
          usefulLife:
            formData.category === "OPEX" || !item.isUsefulLifeEnabled
              ? 0
              : item.usefulLife,
          depreciation: item.depreciation || "0",
        };

        const res = await fetch("/api/finance/expenses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": buildExpenseIdempotencyKey("single"),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal menyimpan data pengeluaran");
        }

        toast.success("Pengeluaran berhasil ditambahkan");
      } else {
        // Batch create multiple items
        const payload = {
          date: formData.date,
          siteId: formData.siteId,
          accountId: formData.accountId,
          invoiceNumber: formData.invoiceNumber,
          invoiceFile: formData.invoiceFile,
          items: items.map((item) => ({
            amount: Number(item.amount),
            description: item.description,
            rabProjectId: item.rabProjectId,
            rabItemId: item.rabItemId,
            category: formData.category,
            expenseCategoryId: item.expenseCategoryId,
            usefulLife:
              formData.category === "OPEX" || !item.isUsefulLifeEnabled
                ? 0
                : item.usefulLife,
            depreciation: item.depreciation || "0",
          })),
        };

        const res = await fetch("/api/finance/expenses/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": buildExpenseIdempotencyKey("batch"),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal menyimpan data pengeluaran");
        }

        toast.success(`${items.length} pengeluaran berhasil ditambahkan`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan data pengeluaran",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah anda yakin ingin menghapus data ini?")) return;

    try {
      const res = await fetch(`/api/finance/expenses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menghapus data");
      }

      toast.success("Data dihapus");
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus data pengeluaran",
      );
    }
  };

  const handleExport = () => {
    const selectedRows = filteredData.filter((item) =>
      selectedExpenseIds.includes(item.id),
    );
    const rowsToExport = selectedRows.length > 0 ? selectedRows : filteredData;

    if (rowsToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const csvContent = buildExpenseCsvContent(
      rowsToExport.map((item) => {
        const rabText = item.rabProject
          ? `${item.rabProject.name}${item.rabItem ? ` (${item.rabItem.name})` : ""}`
          : "-";

        return {
          date: item.date,
          amount: item.amount.toString(),
          category: item.category,
          expenseCategoryName: item.expenseCategory?.name || "-",
          rabText,
          description: item.description || "",
          siteName: item.site?.name || "Umum",
          petugas: item.user?.name || "-",
        };
      }),
    );

    if (selectedRows.length > 0) {
      toast.success(`Export ${selectedRows.length} data terpilih berhasil`);
    } else {
      toast.success(`Export ${filteredData.length} data hasil filter berhasil`);
    }

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `laporan-pengeluaran-${startDate}-to-${endDate}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // RAB Handlers
  const handleOpenRABModal = () => {
    setEditingRAB(null);
    setIsRABModalOpen(true);
  };

  const handleEditRAB = (project: RABProject) => {
    setEditingRAB(project);
    setIsRABModalOpen(true);
  };

  const handleViewRAB = (project: RABProject) => {
    setViewingRAB(project);
    setIsRABViewOpen(true);
  };

  const handleOpenRABRevision = (project: RABProject) => {
    setRevisioningRAB(project);
    setIsRABRevisionModalOpen(true);
  };

  const handleRABSaved = () => {
    setRabRefreshKey((prev) => prev + 1);
    setIsRABModalOpen(false);
  };

  const handleRABRevisionSaved = async () => {
    setRabRefreshKey((prev) => prev + 1);
    if (viewingRAB) {
      try {
        const res = await fetch(
          `/api/finance/rab-projects?refreshKey=${Date.now()}`,
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const updated = json.data.find(
            (p: RABProject) => p.id === viewingRAB.id,
          );
          if (updated) setViewingRAB(updated);
        }
      } catch {
        // fallback: list will refresh via rabRefreshKey
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-red-500" />
            Keuangan & Pengeluaran
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manajemen biaya operasional, modal, dan rencana anggaran
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === "daily" && (
            <button
              type="button"
              onClick={() => setIsDailySimpleMode((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <HiOutlineInformationCircle className="w-5 h-5" />
              <span className="hidden sm:inline">
                {isDailySimpleMode ? "Tampilkan Monitoring" : "Mode Simple"}
              </span>
            </button>
          )}
          {activeTab === "daily" && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <HiOutlineDocumentArrowDown className="w-5 h-5" />
              <span className="hidden sm:inline">
                Export CSV (Pilihan/Filter)
              </span>
            </button>
          )}
          {canCreate && activeTab !== "coa" && (
            <Button
              onClick={() =>
                activeTab === "daily" ? handleOpenModal() : handleOpenRABModal()
              }
              variant="default"
            >
              <HiOutlinePlus className="w-5 h-5" />
              <span className="hidden sm:inline">
                {activeTab === "daily" ? "Tambah Pengeluaran" : "Buat RAB Baru"}
              </span>
              <span className="sm:hidden">Tambah</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`
                                          whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                                          ${
                                            activeTab === "daily"
                                              ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                                          }
                                      `}
          >
            <HiOutlineCurrencyDollar className="w-5 h-5" />
            Pengeluaran Harian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rab")}
            className={`
                                          whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                                          ${
                                            activeTab === "rab"
                                              ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                                          }
                                      `}
          >
            <HiOutlineClipboardDocumentList className="w-5 h-5" />
            RAB (Proyek)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("coa")}
            className={`
                                          whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                                          ${
                                            activeTab === "coa"
                                              ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                                          }
                                      `}
          >
            <HiOutlineTag className="w-5 h-5" />
            COA
          </button>
        </nav>
      </div>

      {activeTab === "daily" ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <HiOutlineCurrencyDollar className="w-16 h-16 text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                TOTAL PENGELUARAN
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <HiOutlineTag className="w-16 h-16 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                TOTAL OPEX (Operasional)
              </p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {formatCurrency(totalOpex)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <HiOutlineBuildingOffice className="w-16 h-16 text-purple-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                TOTAL CAPEX (Modal)
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {formatCurrency(totalCapex)}
              </p>
            </div>
          </div>

          {!isDailySimpleMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  INDIKASI DUPLIKASI
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {dailyIndicators.suspectedDuplicateCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Hanya warning, tidak memblokir input
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  PENDING VERIFIKASI BUKTI
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {dailyIndicators.pendingVerificationCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Transaksi tanpa nomor/foto invoice
                </p>
              </div>
            </div>
          )}

          {/* Filters & Toolbar */}
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
              {/* Date Range */}
              <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
                <HiOutlineCalendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubCategory(""); // Reset sub category when type changes
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">Semua Tipe</option>
                <option value="CAPEX">CAPEX</option>
                <option value="OPEX">OPEX</option>
              </select>

              {/* Sub Category Filter - Only show if Type is selected */}
              {selectedCategory && (
                <select
                  value={selectedSubCategory}
                  onChange={(e) => setSelectedSubCategory(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] animate-in fade-in slide-in-from-left-2 duration-200"
                >
                  <option value="">Semua Kategori</option>
                  {filterCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Site Filter */}
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
              >
                <option value="">Semua Site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative w-full xl:w-72">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari deskripsi atau nominal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <ResponsiveTable
              keyField="id"
              data={paginatedData}
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={[10, 20, 50, 100, "all"]}
              onItemsPerPageChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              loading={loading}
              emptyMessage={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                    <HiOutlineCurrencyDollar className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium">
                    Tidak ada data pengeluaran
                  </p>
                  <p className="text-sm mt-1">
                    Sesuaikan filter atau tambahkan pengeluaran baru
                  </p>
                </div>
              }
              columns={[
                {
                  key: "select",
                  header: (
                    <div
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        disabled={filteredData.length === 0}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        aria-label="Pilih semua data hasil filter"
                      />
                    </div>
                  ),
                  render: (item) => (
                    <div
                      className="flex justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedExpenseIds.includes(item.id)}
                        onChange={() => toggleExpenseSelection(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Pilih pengeluaran ${item.description || item.id}`}
                      />
                    </div>
                  ),
                },
                {
                  key: "date",
                  header: "Tanggal",
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-600 dark:text-gray-400">
                        {new Date(item.date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "amount",
                  header: "Jumlah",
                  render: (item) => (
                    <span className="font-bold text-red-600 dark:text-red-400 font-mono">
                      {formatCurrency(Number(item.amount))}
                    </span>
                  ),
                },
                {
                  key: "category",
                  header: "Tipe",
                  render: (item) => (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        item.category === "CAPEX"
                          ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                          : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
                      }`}
                    >
                      {item.category}
                    </span>
                  ),
                },
                {
                  key: "expenseCategory",
                  header: "Kategori / RAB",
                  render: (item) => (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.expenseCategory?.name || "-"}
                      </span>
                      {item.rabProject && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                          RAB: {item.rabProject.name}
                          {item.rabItem && (
                            <span className="text-gray-500 font-normal">
                              {" "}
                              - {item.rabItem.name}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ),
                },
                // Removed COA & Account Columns
                {
                  key: "description",
                  header: "Keterangan",
                  render: (item) => (
                    <div className="flex flex-col">
                      <span
                        className="text-gray-700 dark:text-gray-300 line-clamp-2"
                        title={item.description}
                      >
                        {item.description || "-"}
                      </span>
                      {item.invoiceNumber && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase">
                            Inv
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {item.invoiceNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "site",
                  header: "Site",
                  render: (item) => {
                    const name = item.site?.name;
                    return name ? (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400" />
                        {name}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-sm">
                        Umum (Pusat)
                      </span>
                    );
                  },
                },
                {
                  key: "user",
                  header: "Petugas",
                  priority: "secondary",
                  render: (item) => item.user?.name || "-",
                },
                ...(canUpdate || canDelete
                  ? [
                      {
                        key: "actions",
                        header: "",
                        render: (item: Expense) => (
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <button
                                type="button"
                                onClick={() => handleOpenModal(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <HiOutlinePencilSquare className="w-5 h-5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <HiOutlineTrash className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              renderMobileCard={(item) => {
                const siteName = item.site?.name || "Umum (Pusat)";

                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-base font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(Number(item.amount))}
                        </p>
                      </div>
                      <label
                        className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(item.id)}
                          onChange={() => toggleExpenseSelection(item.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Pilih pengeluaran ${item.description || item.id}`}
                        />
                        Pilih
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Tipe</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.category}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Site</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {siteName}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500 dark:text-gray-400">
                          Kategori
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.expenseCategory?.name || "-"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500 dark:text-gray-400">
                          Keterangan
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white line-clamp-2">
                          {item.description || "-"}
                        </p>
                      </div>
                    </div>

                    {(canUpdate || canDelete) && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <HiOutlinePencilSquare className="w-5 h-5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <HiOutlineTrash className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>

          {/* Wizard Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            padding={false}
            size="xl"
            showCloseButton={false}
          >
            {/* Stepper Indicator */}
            <div className="bg-gray-50 dark:bg-[#161e2e] p-8 pb-4 rounded-t-[2.5rem]">
              <div className="flex items-center justify-between max-w-xs mx-auto relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 -z-0"></div>
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                      step >= s
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110"
                        : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400"
                    }`}
                  >
                    {step > s ? (
                      <HiOutlineCheckCircle className="w-6 h-6" />
                    ) : (
                      s
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">
                <span
                  className={
                    step === 1 ? "text-blue-600 dark:text-blue-400" : ""
                  }
                >
                  Detail
                </span>
                <span
                  className={
                    step === 2 ? "text-blue-600 dark:text-blue-400" : ""
                  }
                >
                  Klasifikasi
                </span>
                <span
                  className={
                    step === 3 ? "text-blue-600 dark:text-blue-400" : ""
                  }
                >
                  Konfirmasi
                </span>
              </div>
            </div>

            <ModalBody className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Detail Pengeluaran - Multi Item */}
                {step === 1 && (
                  <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <HiOutlineInformationCircle className="text-blue-500 w-5 h-5" />
                      <h2 className="text-xl font-black text-gray-900 dark:text-white">
                        Detail Pengeluaran
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {/* Line Items */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Item Pengeluaran
                          </label>
                          {items.length > 1 && (
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              Total: {formatCurrency(formTotal)}
                            </span>
                          )}
                        </div>

                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border ${idx === 0 ? "border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"} space-y-3 animate-in fade-in slide-in-from-top-1 duration-200`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                Item {idx + 1}
                              </span>
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                  title="Hapus item"
                                >
                                  <HiOutlineXMark className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {/* Amount */}
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-400 text-sm font-bold">
                                    Rp
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  required
                                  autoFocus={idx === 0}
                                  value={
                                    item.amount
                                      ? item.amount
                                          .toString()
                                          .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const rawValue = e.target.value
                                      .replace(/\./g, "")
                                      .replace(/[^0-9]/g, "");
                                    updateItem(idx, "amount", rawValue);
                                  }}
                                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-lg font-bold transition-all"
                                  placeholder="Nominal"
                                />
                              </div>
                              {/* Description */}
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(idx, "description", e.target.value)
                                }
                                className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                placeholder="Keterangan item..."
                              />
                            </div>
                          </div>
                        ))}

                        {/* Add Item Button */}
                        {!editingItem && (
                          <button
                            type="button"
                            onClick={addItem}
                            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <HiOutlinePlus className="w-4 h-4" />
                            Tambah Item
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Tanggal
                          </label>
                          <div className="relative">
                            <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type="date"
                              required
                              value={formData.date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  date: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Site
                          </label>
                          <select
                            value={formData.siteId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                siteId: e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                          >
                            <option value="">-- Umum / Kantor Pusat --</option>
                            {sites.map((site) => (
                              <option key={site.id} value={site.id}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Sumber Dana (Kas/Bank)
                          </label>
                          <select
                            value={formData.accountId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                accountId: e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                          >
                            <option value="">-- Tidak dipilih --</option>
                            {cashAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            Diisi agar pengeluaran tercatat di jurnal dan masuk
                            Laporan Arus Kas.
                          </p>
                        </div>
                      </div>

                      {/* Invoice (Optional) */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-center gap-2 mb-3">
                          <HiOutlineReceiptPercent className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            Invoice (Opsional)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={formData.invoiceNumber}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                invoiceNumber: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                            placeholder="No. Invoice"
                          />
                          <div className="relative">
                            {formData.invoiceFile ? (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-sm">
                                <HiOutlinePaperClip className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span className="text-green-700 dark:text-green-400 truncate flex-1">
                                  {formData.invoiceFile.split("/").pop()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      invoiceFile: "",
                                    })
                                  }
                                  className="text-red-500 hover:text-red-700 flex-shrink-0"
                                >
                                  <HiOutlineXMark className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <label
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isUploadingInvoice ? "opacity-50 pointer-events-none" : ""}`}
                              >
                                <HiOutlinePaperClip className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400">
                                  {isUploadingInvoice
                                    ? "Mengupload..."
                                    : "Upload Invoice"}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleInvoiceUpload(file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Klasifikasi & RAB */}
                {step === 2 && (
                  <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <HiOutlineTag className="text-blue-500 w-5 h-5" />
                      <h2 className="text-xl font-black text-gray-900 dark:text-white">
                        Klasifikasi & Tipe
                      </h2>
                    </div>

                    {/* Tipe: OPEX/CAPEX Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, category: "OPEX" });
                          setItems((prev) =>
                            prev.map((item) => ({
                              ...item,
                              expenseCategoryId: "",
                            })),
                          );
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all group ${
                          formData.category === "OPEX"
                            ? "bg-orange-50/50 border-orange-500 shadow-sm dark:bg-orange-900/20 dark:border-orange-500"
                            : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-white text-sm">
                          OPEX
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          Operasional
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, category: "CAPEX" });
                          setItems((prev) =>
                            prev.map((item) => ({
                              ...item,
                              expenseCategoryId: "",
                            })),
                          );
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all group ${
                          formData.category === "CAPEX"
                            ? "bg-purple-50/50 border-purple-500 shadow-sm dark:bg-purple-900/20 dark:border-purple-500"
                            : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-white text-sm">
                          CAPEX
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          Modal
                        </div>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm relative space-y-4"
                        >
                          {items.length > 1 && (
                            <div className="absolute top-0 left-0 bg-gray-100 dark:bg-gray-700 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-tl-xl rounded-br-lg z-10">
                              Item {idx + 1}
                            </div>
                          )}

                          <div className="pb-2 border-b border-gray-100 dark:border-gray-700 mt-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {formatCurrency(Number(item.amount) || 0)} —{" "}
                              {item.description || "Tanpa keterangan"}
                            </p>
                          </div>

                          {/* Expense Category */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                              Kategori Pengeluaran (COA)
                            </label>
                            <div className="relative">
                              <Combobox
                                options={
                                  formData.category === "CAPEX"
                                    ? capexCategoryOptions
                                    : opexCategoryOptions
                                }
                                value={item.expenseCategoryId}
                                onChange={(val) =>
                                  updateItem(idx, "expenseCategoryId", val)
                                }
                                placeholder="Pilih kategori pengeluaran..."
                                loading={isLoadingCategories}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* RAB Project */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Terkait RAB Project (Opsional)
                              </label>
                              <select
                                value={item.rabProjectId}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            rabProjectId: e.target.value,
                                            rabItemId: "",
                                          }
                                        : it,
                                    ),
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm py-1.5 focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">
                                  -- Tidak Terkait RAB --
                                </option>
                                {rabProjects.map((rab) => (
                                  <option key={rab.id} value={rab.id}>
                                    {rab.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Per-Item RAB Selection */}
                            {item.rabProjectId && (
                              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                  Terkait Item RAB
                                </label>
                                <select
                                  value={item.rabItemId}
                                  onChange={(e) => {
                                    const selectedItemId = e.target.value;
                                    let newDescription = item.description;
                                    if (selectedItemId) {
                                      const selectedRabItem = rabProjects
                                        .find((r) => r.id === item.rabProjectId)
                                        ?.items?.find(
                                          (i) => i.id === selectedItemId,
                                        );
                                      if (selectedRabItem) {
                                        const qtyText = selectedRabItem.quantity
                                          ? ` (Qty: ${selectedRabItem.quantity})`
                                          : "";
                                        newDescription = `${selectedRabItem.name}${qtyText}`;
                                      }
                                    }
                                    setItems((prev) =>
                                      prev.map((it, i) =>
                                        i === idx
                                          ? {
                                              ...it,
                                              rabItemId: selectedItemId,
                                              description: newDescription,
                                            }
                                          : it,
                                      ),
                                    );
                                  }}
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm py-1.5 focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">
                                    -- Bebas / Tidak Spesifik --
                                  </option>
                                  {rabProjects
                                    .find((r) => r.id === item.rabProjectId)
                                    ?.items?.filter((i) =>
                                      formData.category
                                        ? i.expenseType === formData.category
                                        : true,
                                    )
                                    .map((rabItem) => (
                                      <option
                                        key={rabItem.id}
                                        value={rabItem.id}
                                      >
                                        {rabItem.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Konfirmasi */}
                {step === 3 && (
                  <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <HiOutlineCheckCircle className="text-blue-500 w-5 h-5" />
                      <h2 className="text-xl font-black text-gray-900 dark:text-white">
                        Konfirmasi Data
                      </h2>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b border-blue-200/30">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase">
                          Total Nominal
                        </span>
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                          {formatCurrency(formTotal)}
                        </span>
                      </div>

                      {/* Items List */}
                      {items.length > 1 && (
                        <div className="space-y-3 py-3 border-b border-blue-200/30">
                          <p className="text-[10px] font-black text-gray-400 uppercase">
                            Item ({items.length})
                          </p>
                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between text-xs pb-2"
                            >
                              <div className="space-y-1 flex-1 pr-3">
                                <p className="text-gray-700 dark:text-gray-200 font-semibold truncate">
                                  {idx + 1}.{" "}
                                  {item.description || "Tanpa keterangan"}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                    {formData.category}
                                  </span>
                                  <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                                    {categories.find(
                                      (c) => c.id === item.expenseCategoryId,
                                    )?.name || "Tanpa COA"}
                                  </span>
                                  {item.rabProjectId && (
                                    <>
                                      <span className="text-gray-300 dark:text-gray-600">
                                        •
                                      </span>
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                        RAB:{" "}
                                        {
                                          rabProjects.find(
                                            (r) => r.id === item.rabProjectId,
                                          )?.name
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                                {formatCurrency(Number(item.amount) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase">
                            Tanggal
                          </p>
                          <p className="font-bold text-gray-700 dark:text-gray-200">
                            {formData.date}
                          </p>
                        </div>
                        {items.length === 1 && (
                          <>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase">
                                Tipe
                              </p>
                              <p className="font-bold text-gray-700 dark:text-gray-200">
                                <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                  {formData.category}
                                </span>
                              </p>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase">
                                Kategori / COA
                              </p>
                              <p className="font-bold text-gray-700 dark:text-gray-200">
                                {categories.find(
                                  (c) => c.id === items[0].expenseCategoryId,
                                )?.name || "-"}
                              </p>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase">
                                Keterangan
                              </p>
                              <p className="text-gray-600 dark:text-gray-400 italic">
                                &quot;
                                {items[0].description || "Tidak ada keterangan"}
                                &quot;
                              </p>
                            </div>
                          </>
                        )}
                        {formData.invoiceNumber && (
                          <div className="col-span-2 space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase">
                              No. Invoice
                            </p>
                            <p className="font-bold text-gray-700 dark:text-gray-200">
                              {formData.invoiceNumber}
                            </p>
                          </div>
                        )}
                        {formData.invoiceFile && (
                          <div className="col-span-2 space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase">
                              File Invoice
                            </p>
                            <div className="flex items-center gap-1.5">
                              <HiOutlinePaperClip className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-700 dark:text-green-400 text-xs">
                                {formData.invoiceFile.split("/").pop()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between gap-4 pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
                  {step > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={prevStep}
                      className="flex items-center gap-2"
                    >
                      <HiOutlineArrowLeft className="w-5 h-5" />
                      Kembali
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Batal
                    </Button>
                  )}

                  {step < 3 ? (
                    <Button type="button" onClick={nextStep}>
                      Lanjut
                      <HiOutlineArrowRight className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button type="submit" loading={isSubmitting}>
                      {items.length > 1
                        ? `Simpan ${items.length} Transaksi`
                        : "Simpan Transaksi"}
                    </Button>
                  )}
                </div>
              </form>
            </ModalBody>
          </Modal>
        </>
      ) : activeTab === "rab" ? (
        /* RAB View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Pending Approval
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {isLoadingRabMetrics
                  ? "..."
                  : (rabBottleneckMetrics?.pendingApprovalCount ?? 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                RAB sedang menunggu approver
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Oldest Pending
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {isLoadingRabMetrics
                  ? "..."
                  : `${rabBottleneckMetrics?.oldestPendingDays ?? 0} hari`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                {rabBottleneckMetrics?.oldestPendingProjectName ||
                  "Belum ada antrian pending"}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                Rata-rata Approval
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {isLoadingRabMetrics
                  ? "..."
                  : `${rabBottleneckMetrics?.averageApprovalLeadHours ?? 0} jam`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lead time approval dari pengajuan
              </p>
            </div>
          </div>

          <RABList
            initialData={rabProjects}
            refreshKey={rabRefreshKey}
            onEdit={handleEditRAB}
            onView={handleViewRAB}
            onRevise={handleOpenRABRevision}
            onRefreshRequested={handleRABRevisionSaved}
          />

          <RABForm
            isOpen={isRABModalOpen}
            onClose={() => setIsRABModalOpen(false)}
            onSaved={handleRABSaved}
            initialData={editingRAB}
            sites={sites}
          />

          <RABView
            isOpen={isRABViewOpen}
            data={viewingRAB}
            onRefresh={handleRABRevisionSaved}
            onOpenRevision={canUpdate ? handleOpenRABRevision : undefined}
            onClose={() => setIsRABViewOpen(false)}
          />

          {revisioningRAB && (
            <RABRevisionForm
              open={isRABRevisionModalOpen}
              projectId={revisioningRAB.id}
              projectName={revisioningRAB.name}
              onClose={() => {
                setIsRABRevisionModalOpen(false);
                setRevisioningRAB(null);
              }}
              onSaved={handleRABRevisionSaved}
            />
          )}
        </div>
      ) : (
        /* COA View */
        <CategoryList />
      )}
    </div>
  );
}
