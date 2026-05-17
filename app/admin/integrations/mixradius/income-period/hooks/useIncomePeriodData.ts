"use client";

import { useState, useEffect, useCallback } from "react";
import { clientLogger } from "@/lib/client-logger";
import toast from "react-hot-toast";
import {
  calculateAllSiteExpenses,
  calculateIncomePeriodExpenseAllocation,
  calculateIncomePeriodNet,
  FETCH_ALL_LIMIT,
  type IncomePeriodExpenseItem,
} from "../calculations";
import type { FeeConfig } from "../FeeConfigurationModal";
import { useApi } from "@/lib/hooks/useApi";

// --- Types ---

export interface IncomePeriodRecord {
  id: string;
  invoice: string;
  member_id: string;
  username: string;
  fullname: string;
  plan_name: string;
  total: string | number;
  seller_fee: string | number;
  renewed_on: string;
  owner_name: string;
  trx_status: string;
  payment_method: string;
  payment_type: string;
  nasporttype: string;
  method: string;
}

interface IncomePeriodResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: IncomePeriodRecord[];
  summary?: {
    profit: string;
    feeSeller: string;
    totalPlusPpn: string;
    totalTransactions: string;
  };
}

export interface MitraSale {
  id: string;
  name: string;
  mixradiusOwnerNames: string[];
  mitraRateFeePelanggan: number;
}

export interface RABItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  expenseType?: "CAPEX" | "OPEX";
}

export interface RABProject {
  id: string;
  name: string;
  description?: string;
  siteId?: string;
  mixRadiusGroupId?: string;
  site?: { name: string };
  mixRadiusGroup?: { name: string };
  projectedRevenue: number;
  projectedOpex: number;
  targetSubscribers?: number;
  arpu?: number;
  growthType?: "LINEAR" | "PERCENTAGE" | "CUSTOM";
  growthSettings?: unknown;
  startDate?: string;
  status: string;
  items: RABItem[];
  createdAt: string;
}

// --- Hook ---

export function useIncomePeriodData() {
  // Core data state
  const [data, setData] = useState<IncomePeriodRecord[]>([]);
  const [summary, setSummary] = useState<
    IncomePeriodResponse["summary"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [serviceType, setServiceType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [groups, setGroups] = useState<
    { id: string; name: string; siteId?: string }[]
  >([]);
  const [selectedGroup, setSelectedGroup] = useState("all");

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Sorting state
  const [sortColumn, setSortColumn] = useState("renewed_on");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fee config state
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({});
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [netIncome, setNetIncome] = useState<number>(0);
  const [estGatewayFee, setEstGatewayFee] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [specificExpenses, setSpecificExpenses] = useState<number>(0);
  const [allocatedExpenses, setAllocatedExpenses] = useState<number>(0);

  // RAB project state
  const [rabProject, setRabProject] = useState<RABProject | null>(null);
  const [rabProjects, setRabProjects] = useState<RABProject[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [rabLoading, setRabLoading] = useState(false);
  const [isCalculatingNet, setIsCalculatingNet] = useState(false);

  // Global records (for mitra calculations)
  const [globalRecords, setGlobalRecords] = useState<IncomePeriodRecord[]>([]);

  // Mitra sales
  const [mitraSales, setMitraSales] = useState<MitraSale[]>([]);

  // Payouts
  const [payouts, setPayouts] = useState<
    Array<{ referenceId?: string; amount: string | number }>
  >([]);

  // --- Debounce search ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Helper: parse RAB project numeric values ---
  const parseRABProject = useCallback(
    (project: Record<string, unknown>): RABProject =>
      ({
        ...project,
        projectedRevenue: Number(project.projectedRevenue),
        projectedOpex: Number(project.projectedOpex),
        arpu: project.arpu ? Number(project.arpu) : undefined,
        items: (
          (project.items as Array<
            RABItem & {
              unitPrice: string | number;
              totalPrice: string | number;
            }
          >) || []
        ).map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      }) as RABProject,
    [],
  );

  // --- Fetch filter data via useApi paralel ---
  const { data: groupsRaw } = useApi<unknown>(
    "/api/integrations/mixradius/groups",
  );
  const { data: feesRaw } = useApi<unknown>("/api/integrations/mixradius/fees");
  const { data: rabRaw } = useApi<unknown>("/api/finance/rab-projects");
  const { data: mitraRaw } = useApi<unknown>(
    "/api/admin/mitra?type=MITRA_SALES&limit=1000",
  );
  const { data: payoutRaw } = useApi<unknown>(
    "/api/admin/mitra/transactions?type=EARNING&limit=1000",
  );

  const [didHydrateGroups, setDidHydrateGroups] = useState(false);
  if (groupsRaw && !didHydrateGroups) {
    setDidHydrateGroups(true);
    const obj = groupsRaw as Record<string, unknown>;
    if (obj.success && Array.isArray(obj.data)) {
      setGroups(
        obj.data as Array<{ id: string; name: string; siteId?: string }>,
      );
    }
  }

  const [didHydrateFees, setDidHydrateFees] = useState(false);
  if (feesRaw && !didHydrateFees) {
    setDidHydrateFees(true);
    const obj = feesRaw as Record<string, unknown>;
    if (obj.success) {
      setFeeConfig(obj.data as FeeConfig);
    }
  }

  const [didHydrateRab, setDidHydrateRab] = useState(false);
  if (rabRaw && !didHydrateRab) {
    setDidHydrateRab(true);
    if (Array.isArray(rabRaw)) {
      setRabProjects(
        (rabRaw as unknown[]).map((p) =>
          parseRABProject(p as Record<string, unknown>),
        ),
      );
    }
  }

  const [didHydrateMitra, setDidHydrateMitra] = useState(false);
  if (mitraRaw && !didHydrateMitra) {
    setDidHydrateMitra(true);
    const obj = mitraRaw as Record<string, unknown>;
    const dataObj = obj.data as { mitras?: MitraSale[] } | undefined;
    if (obj.success && dataObj?.mitras) {
      setMitraSales(dataObj.mitras);
    }
  }

  const [didHydratePayouts, setDidHydratePayouts] = useState(false);
  if (payoutRaw && !didHydratePayouts) {
    setDidHydratePayouts(true);
    const obj = payoutRaw as Record<string, unknown>;
    const dataObj = obj.data as { transactions?: unknown[] } | undefined;
    if (obj.success && Array.isArray(dataObj?.transactions)) {
      setPayouts(
        dataObj.transactions as Array<{
          referenceId?: string;
          amount: string | number;
        }>,
      );
    }
  }

  // --- Handle project selection ---
  const handleProjectSelect = useCallback(
    (projectId: string) => {
      setSelectedProject(projectId);

      if (!projectId) {
        setRabProject(null);
        return;
      }

      const project = rabProjects.find((p) => p.id === projectId);
      if (project) {
        setRabProject(project);

        // Auto-set group filter
        if (project.mixRadiusGroupId) {
          setSelectedGroup(project.mixRadiusGroupId);
        }

        // Auto-set start date from project start date
        if (project.startDate) {
          const d = new Date(project.startDate);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          setStartDate(`${year}-${month}-${day}`);
        }

        setPage(0);
      }
    },
    [rabProjects],
  );

  // --- Fetch RAB project when group changes (no explicit project selected) ---
  useEffect(() => {
    const fetchRABProject = async () => {
      if (selectedProject) return;

      if (!selectedGroup || selectedGroup === "all") {
        setRabProject(null);
        return;
      }

      setRabLoading(true);
      try {
        const res = await fetch(
          `/api/finance/rab-projects?mixRadiusGroupId=${selectedGroup}`,
        );
        if (res.ok) {
          const projects = await res.json();
          if (Array.isArray(projects) && projects.length > 0) {
            setRabProject(parseRABProject(projects[0]));
          } else {
            setRabProject(null);
          }
        }
      } catch (err) {
        clientLogger.error("Failed to fetch RAB project:", err);
        setRabProject(null);
      } finally {
        setRabLoading(false);
      }
    };

    fetchRABProject();
  }, [selectedGroup, selectedProject, parseRABProject]);

  // --- Calculate net income wrapper ---
  const calculateNetIncome = useCallback(
    (records: IncomePeriodRecord[]) => {
      return calculateIncomePeriodNet(records, feeConfig);
    },
    [feeConfig],
  );

  // --- Reset net income when no records (handled outside effect via prevProp comparator) ---
  const [prevTotalRecordsZero, setPrevTotalRecordsZero] = useState(
    totalRecords === 0,
  );
  const isZeroNow = totalRecords === 0;
  if (prevTotalRecordsZero !== isZeroNow) {
    setPrevTotalRecordsZero(isZeroNow);
    if (isZeroNow) {
      setNetIncome(0);
      setEstGatewayFee(0);
    }
  }

  // --- Calculate global net income (fetch all data in background) ---
  useEffect(() => {
    if (totalRecords === 0) {
      // Already handled above via prevProp comparator
      return;
    }

    const calcGlobal = async () => {
      setIsCalculatingNet(true);
      try {
        const params = new URLSearchParams({
          start: "0",
          length: String(FETCH_ALL_LIMIT),
          search: debouncedSearch,
          sortBy: sortColumn,
          sortDir: sortDirection,
          fdate: startDate,
          tdate: endDate,
        });

        if (serviceType) params.append("stype", serviceType);
        if (paymentMethod) params.append("payment_method", paymentMethod);
        if (selectedGroup && selectedGroup !== "all")
          params.append("groupId", selectedGroup);

        const response = await fetch(
          `/api/integrations/mixradius/reports/period?${params}`,
        );
        const result = await response.json();

        // Fetch expenses matching the period and site
        let expensesTotal = 0;
        try {
          if (selectedGroup && selectedGroup !== "all") {
            // Specific group: Total = (Group Specific) + (General * Weight)
            const globalParams = new URLSearchParams({
              start: "0",
              length: "1",
              search: debouncedSearch,
              fdate: startDate,
              tdate: endDate,
            });
            if (serviceType) globalParams.append("stype", serviceType);
            if (paymentMethod)
              globalParams.append("payment_method", paymentMethod);

            const [specificJson, generalJson, globalStatsRes] =
              await Promise.all([
                fetch(
                  `/api/finance/expenses?startDate=${startDate}&endDate=${endDate}&mixRadiusGroupId=${selectedGroup}`,
                ).then((r) => r.json()),
                fetch(
                  `/api/finance/expenses?startDate=${startDate}&endDate=${endDate}&scope=general`,
                ).then((r) => r.json()),
                fetch(
                  `/api/integrations/mixradius/reports/period?${globalParams}`,
                ),
              ]);

            const specificExpenseItems = Array.isArray(specificJson?.data)
              ? (specificJson.data as IncomePeriodExpenseItem[])
              : [];
            const generalExpenseItems = Array.isArray(generalJson?.data)
              ? (generalJson.data as IncomePeriodExpenseItem[])
              : [];

            if (globalStatsRes.ok) {
              const globalData = await globalStatsRes.json();
              const globalSummary = globalData.data?.summary;
              const siteSummary = result.data?.summary;

              const allocation = calculateIncomePeriodExpenseAllocation({
                specificExpenses: specificExpenseItems,
                generalExpenses: generalExpenseItems,
                siteTransactions: siteSummary?.totalTransactions ?? null,
                globalTransactions: globalSummary?.totalTransactions ?? null,
                siteRevenue: siteSummary?.profit ?? null,
                globalRevenue: globalSummary?.profit ?? null,
                totalGroups: groups.length || 1,
              });

              expensesTotal = allocation.totalExpenses;
              setSpecificExpenses(allocation.specificExpenses);
              setAllocatedExpenses(allocation.allocatedExpenses);
            } else {
              const allocation = calculateIncomePeriodExpenseAllocation({
                specificExpenses: specificExpenseItems,
                generalExpenses: generalExpenseItems,
                siteTransactions: null,
                globalTransactions: null,
                siteRevenue: null,
                globalRevenue: null,
                totalGroups: groups.length || 1,
              });

              expensesTotal = allocation.totalExpenses;
              setSpecificExpenses(allocation.specificExpenses);
              setAllocatedExpenses(allocation.allocatedExpenses);
            }
          } else {
            // All sites: fetch everything (Specific + General)
            const expParams = new URLSearchParams({
              startDate: startDate,
              endDate: endDate,
            });
            const expRes = await fetch(`/api/finance/expenses?${expParams}`);
            if (expRes.ok) {
              const expData = await expRes.json();
              const expItems = Array.isArray(expData?.data) ? expData.data : [];
              if (expItems.length > 0) {
                const allocation = calculateAllSiteExpenses(
                  expItems as IncomePeriodExpenseItem[],
                );
                expensesTotal = allocation.totalExpenses;
                setSpecificExpenses(allocation.specificExpenses);
                setAllocatedExpenses(allocation.allocatedExpenses);
              }
            }
          }
        } catch (err) {
          clientLogger.error("Error fetching expenses", err);
        }
        setTotalExpenses(expensesTotal);

        if (result.success && result.data?.data) {
          const allData = result.data.data as IncomePeriodRecord[];
          setGlobalRecords(allData);
          const { net, fee } = calculateNetIncome(allData);
          setNetIncome(net - expensesTotal);
          setEstGatewayFee(fee);
        } else {
          setGlobalRecords([]);
        }
      } catch (e) {
        clientLogger.error("Error calculating net income", e);
      } finally {
        setIsCalculatingNet(false);
      }
    };

    // Debounce the calculation to avoid spamming API
    const timer = setTimeout(() => {
      calcGlobal();
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    totalRecords,
    feeConfig,
    startDate,
    endDate,
    serviceType,
    paymentMethod,
    selectedGroup,
    debouncedSearch,
    sortColumn,
    sortDirection,
    calculateNetIncome,
    groups.length,
  ]);

  // --- Save fee configuration ---
  const handleSaveFees = async (newFees: FeeConfig) => {
    try {
      const res = await fetch("/api/integrations/mixradius/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFees),
      });
      if (res.ok) {
        setFeeConfig(newFees);
        toast.success("Konfigurasi fee tersimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } catch (e) {
      clientLogger.error("Gagal menyimpan konfigurasi fee", e);
      toast.error("Terjadi kesalahan");
    }
  };

  // --- Fetch paginated data ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: (page * pageSize).toString(),
        length: pageSize.toString(),
        search: debouncedSearch,
        sortBy: sortColumn,
        sortDir: sortDirection,
        fdate: startDate,
        tdate: endDate,
      });

      if (serviceType) params.append("stype", serviceType);
      if (paymentMethod) params.append("payment_method", paymentMethod);
      if (selectedGroup && selectedGroup !== "all")
        params.append("groupId", selectedGroup);

      const response = await fetch(
        `/api/integrations/mixradius/reports/period?${params}`,
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || "Gagal mengambil data laporan pendapatan",
        );
      }

      const result = await response.json();
      const responseData = result.data as IncomePeriodResponse;

      setData(responseData.data || []);
      setSummary(responseData.summary || null);
      setTotalRecords(responseData.recordsFiltered || 0);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Gagal mengambil data laporan pendapatan";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    sortColumn,
    sortDirection,
    startDate,
    endDate,
    serviceType,
    paymentMethod,
    selectedGroup,
  ]);

  // --- Trigger fetch on filter changes (via prevProp comparator + microtask) ---
  const fetchSignature = `${page}|${pageSize}|${debouncedSearch}|${sortColumn}|${sortDirection}|${startDate}|${endDate}|${serviceType}|${paymentMethod}|${selectedGroup}`;
  const [prevFetchSig, setPrevFetchSig] = useState<string | null>(null);
  if (prevFetchSig !== fetchSignature) {
    setPrevFetchSig(fetchSignature);
    // Defer fetch to avoid synchronous setState in effect
    queueMicrotask(() => {
      void fetchData();
    });
  }

  // --- Export to CSV ---
  const handleExport = async () => {
    try {
      toast.loading("Menyiapkan data export...", { id: "export" });

      const params = new URLSearchParams({
        start: "0",
        length: String(FETCH_ALL_LIMIT),
        search: debouncedSearch,
        sortBy: sortColumn,
        sortDir: sortDirection,
        fdate: startDate,
        tdate: endDate,
      });

      if (serviceType) params.append("stype", serviceType);
      if (paymentMethod) params.append("payment_method", paymentMethod);
      if (selectedGroup && selectedGroup !== "all")
        params.append("groupId", selectedGroup);

      const response = await fetch(
        `/api/integrations/mixradius/reports/period?${params}`,
      );
      const result = await response.json();

      if (!result.success || !result.data?.data) {
        throw new Error("Gagal mengambil data untuk export");
      }

      const records = result.data.data as IncomePeriodRecord[];

      // Generate CSV
      const headers = [
        "Invoice",
        "Pelanggan",
        "Username",
        "Paket",
        "Total",
        "Fee Seller",
        "Status",
        "Tanggal",
        "Owner",
        "Metode Bayar",
      ];
      const csvContent = [
        headers.join(","),
        ...records.map((r) =>
          [
            `"${r.invoice}"`,
            `"${r.fullname}"`,
            `"${r.username}"`,
            `"${r.plan_name}"`,
            `"${r.total}"`,
            `"${r.seller_fee}"`,
            `"${r.trx_status}"`,
            `"${r.renewed_on}"`,
            `"${r.owner_name}"`,
            `"${r.payment_method}"`,
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Laporan_Pendapatan_${startDate}_${endDate}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Export berhasil!", { id: "export" });
    } catch (err) {
      toast.error("Gagal export data", { id: "export" });
      clientLogger.error("Gagal export data pendapatan MixRadius", err);
    }
  };

  // --- Sort handler ---
  const handleSort = useCallback(
    (column: string, direction: "asc" | "desc") => {
      setSortColumn(column);
      setSortDirection(direction);
      setPage(0);
    },
    [],
  );

  // --- Derived values ---
  const totalPages = Math.ceil(totalRecords / pageSize);

  return {
    // Data
    data,
    summary,
    loading,
    error,
    globalRecords,
    // Filters
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    serviceType,
    setServiceType,
    paymentMethod,
    setPaymentMethod,
    groups,
    selectedGroup,
    setSelectedGroup,
    search,
    setSearch,
    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    // Sorting
    sortColumn,
    sortDirection,
    handleSort,
    // Fee
    feeConfig,
    showFeeModal,
    setShowFeeModal,
    netIncome,
    estGatewayFee,
    totalExpenses,
    specificExpenses,
    allocatedExpenses,
    isCalculatingNet,
    handleSaveFees,
    // RAB
    rabProject,
    rabProjects,
    selectedProject,
    rabLoading,
    handleProjectSelect,
    // Mitra
    mitraSales,
    payouts,
    setPayouts,
    // Actions
    fetchData,
    handleExport,
  };
}
