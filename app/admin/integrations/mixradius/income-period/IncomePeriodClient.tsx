"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineCog,
  HiOutlineInformationCircle,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineCalculator,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClipboardDocumentList,
} from "react-icons/hi2";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import FeeConfigurationModal, { type FeeConfig } from "./FeeConfigurationModal";
import {
  calculateAllSiteExpenses,
  calculateIncomePeriodCumulativeRoi,
  calculateIncomePeriodExpenseAllocation,
  calculateIncomePeriodNet,
  calculateIncomePeriodRoiDisplayMetrics,
  calculateIncomePeriodSelectedPeriodMetrics,
  parseIncomePeriodNumber,
  type IncomePeriodExpenseItem,
} from "./calculations";
import { NPLSummary } from "@/components/mixradius/NPLSummary";
import { formatCurrency } from "@/lib/utils";

interface IncomePeriodRecord {
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

interface MitraSale {
  id: string;
  name: string;
  mixradiusOwnerNames: string[];
  mitraRateFeePelanggan: number;
}

// RAB Project types for comparison
interface RABItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  expenseType?: "CAPEX" | "OPEX";
}

interface RABProject {
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

export default function IncomePeriodClient() {
  const [data, setData] = useState<IncomePeriodRecord[]>([]);
  const [summary, setSummary] = useState<
    IncomePeriodResponse["summary"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters
  const [startDate, setStartDate] = useState(() => {
    // Default: Start of current month (Timezone safe)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    // Default: Today (Timezone safe)
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

  // Fee Config State
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({});
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [netIncome, setNetIncome] = useState<number>(0);
  const [estGatewayFee, setEstGatewayFee] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [specificExpenses, setSpecificExpenses] = useState<number>(0);
  const [allocatedExpenses, setAllocatedExpenses] = useState<number>(0);

  // RAB Project Comparison State
  const [rabProject, setRabProject] = useState<RABProject | null>(null);
  const [rabProjects, setRabProjects] = useState<RABProject[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [rabLoading, setRabLoading] = useState(false);
  const [isCalculatingNet, setIsCalculatingNet] = useState(false);

  // ROI Tracking State
  const [cumulativeRevenue, setCumulativeRevenue] = useState<number>(0);
  const [cumulativeExpenses, setCumulativeExpenses] = useState<number>(0);
  const [cumulativeNetIncome, setCumulativeNetIncome] = useState<number>(0);
  const [cumulativeGatewayFee, setCumulativeGatewayFee] = useState<number>(0);
  const [_cumulativeSellerFee, setCumulativeSellerFee] = useState<number>(0);

  // Mitra Sales Tracking Data
  const [globalRecords, setGlobalRecords] = useState<IncomePeriodRecord[]>([]);
  const [mitraSales, setMitraSales] = useState<MitraSale[]>([]);
  const [roiLoading, setRoiLoading] = useState(false);
  const [projectMonthsElapsed, setProjectMonthsElapsed] = useState<number>(0);
  // Breakdown pengeluaran kumulatif
  const [cumCapexFromRab, setCumCapexFromRab] = useState<number>(0);
  const [cumCapexUmum, setCumCapexUmum] = useState<number>(0);
  const [cumOpexAktual, setCumOpexAktual] = useState<number>(0);
  const [cumOpexUmum, setCumOpexUmum] = useState<number>(0);
  const [cumOpexProyeksi, setCumOpexProyeksi] = useState<number>(0);
  const [cumDepreciation, setCumDepreciation] = useState<number>(0);

  // Sorting state
  const [sortColumn, setSortColumn] = useState("renewed_on");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payouts, setPayouts] = useState<any[]>([]);
  const [syncingMitra, setSyncingMitra] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [_globalTotal, setGlobalTotal] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Helper to parse RAB project numeric values
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

  // Fetch data for filters, Fees & RAB Projects
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [groupsRes, feesRes, rabRes, mitraRes] = await Promise.all([
          fetch("/api/integrations/mixradius/groups"),
          fetch("/api/integrations/mixradius/fees"),
          fetch("/api/finance/rab-projects"),
          fetch("/api/admin/mitra?type=MITRA_SALES&limit=1000"),
        ]);

        if (groupsRes.ok) {
          const result = await groupsRes.json();
          if (result.success && Array.isArray(result.data)) {
            setGroups(result.data);
          }
        }

        if (feesRes.ok) {
          const result = await feesRes.json();
          if (result.success) {
            setFeeConfig(result.data);
          }
        }

        if (rabRes.ok) {
          const projects = await rabRes.json();
          if (Array.isArray(projects)) {
            setRabProjects(projects.map(parseRABProject));
          }
        }

        if (mitraRes.ok) {
          const mitraData = await mitraRes.json();
          if (mitraData.success && mitraData.data?.mitras) {
            setMitraSales(mitraData.data.mitras);
          }
        }

        // Fetch Payout History
        const payoutRes = await fetch(
          "/api/admin/mitra/transactions?type=EARNING&limit=1000",
        );
        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          if (
            payoutData.success &&
            Array.isArray(payoutData.data?.transactions)
          ) {
            setPayouts(payoutData.data.transactions);
          }
        }
      } catch (err) {
        console.error("Failed to fetch filter data:", err);
      }
    };
    fetchFilterData();
  }, [parseRABProject]);

  // Handle project selection - auto-set group and date range
  const handleProjectSelect = useCallback(
    (projectId: string) => {
      setSelectedProject(projectId);

      if (!projectId) {
        // Clearing project selection - don't reset group/date
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

  // Fetch RAB Project for selected group (when no project is explicitly selected)
  useEffect(() => {
    const fetchRABProject = async () => {
      // Skip if project is explicitly selected (already handled by handleProjectSelect)
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
        console.error("Failed to fetch RAB project:", err);
        setRabProject(null);
      } finally {
        setRabLoading(false);
      }
    };

    fetchRABProject();
  }, [selectedGroup, selectedProject, parseRABProject]);

  const parseNumber = parseIncomePeriodNumber;

  const calculateNetIncome = useCallback(
    (records: IncomePeriodRecord[]) => {
      return calculateIncomePeriodNet(records, feeConfig);
    },
    [feeConfig],
  );

  // Calculate Global Net Income (Fetch all data in background)
  useEffect(() => {
    if (totalRecords === 0) {
      setNetIncome(0);
      setEstGatewayFee(0);
      return;
    }

    const calcGlobal = async () => {
      setIsCalculatingNet(true);
      try {
        const params = new URLSearchParams({
          start: "0",
          length: "10000", // Fetch enough for calculation
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

        // Fetch Expenses matching the period and site
        let expensesTotal = 0;
        try {
          if (selectedGroup && selectedGroup !== "all") {
            // If a specific group is selected:
            // Total = (Group Specific Expenses) + (General Expenses * Weight)
            // Weight = ((SiteTrx/GlobalTrx) + (SiteRev/GlobalRev)) / 2

            // 1. Get Global Stats (Same period/filters, but ALL groups)
            const globalParams = new URLSearchParams({
              start: "0",
              length: "1", // Summary only
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

            const specificExpenseItems = Array.isArray(specificJson)
              ? (specificJson as IncomePeriodExpenseItem[])
              : [];
            const generalExpenseItems = Array.isArray(generalJson)
              ? (generalJson as IncomePeriodExpenseItem[])
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
            // If All Sites selected, fetch everything (Specific + General)
            const params = new URLSearchParams({
              startDate: startDate,
              endDate: endDate,
            });
            const expRes = await fetch(`/api/finance/expenses?${params}`);
            if (expRes.ok) {
              const expData = await expRes.json();
              if (Array.isArray(expData)) {
                const allocation = calculateAllSiteExpenses(
                  expData as IncomePeriodExpenseItem[],
                );
                expensesTotal = allocation.totalExpenses;
                setSpecificExpenses(allocation.specificExpenses);
                setAllocatedExpenses(allocation.allocatedExpenses);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching expenses", err);
        }
        setTotalExpenses(expensesTotal);

        if (result.success && result.data?.data) {
          const allData = result.data.data as IncomePeriodRecord[];
          setGlobalRecords(allData);
          const { net, fee } = calculateNetIncome(allData);
          setNetIncome(net - expensesTotal); // Deduct expenses
          setEstGatewayFee(fee);
        } else {
          setGlobalRecords([]);
        }
      } catch (e) {
        console.error("Error calculating net income", e);
      } finally {
        setIsCalculatingNet(false);
      }
    };

    // Debounce the calculation to avoid spamming API on every keystroke
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
    parseNumber,
  ]); // Recalculate when filters or fees change

  // Calculate Cumulative ROI for selected project (lifetime from startDate to now)
  useEffect(() => {
    if (!rabProject || !rabProject.startDate || !rabProject.mixRadiusGroupId) {
      setCumulativeRevenue(0);
      setCumulativeExpenses(0);
      setCumulativeNetIncome(0);
      setCumulativeGatewayFee(0);
      setCumulativeSellerFee(0);
      setProjectMonthsElapsed(0);
      setCumCapexFromRab(0);
      setCumCapexUmum(0);
      setCumOpexAktual(0);
      setCumOpexUmum(0);
      setCumOpexProyeksi(0);
      setCumDepreciation(0);
      return;
    }

    const calcROI = async () => {
      setRoiLoading(true);
      try {
        const projectStart = new Date(rabProject.startDate!);
        const now = new Date();
        const projectStartStr = `${projectStart.getFullYear()}-${String(projectStart.getMonth() + 1).padStart(2, "0")}-${String(projectStart.getDate()).padStart(2, "0")}`;
        const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        // Calculate months elapsed
        const months =
          (now.getFullYear() - projectStart.getFullYear()) * 12 +
          (now.getMonth() - projectStart.getMonth());
        setProjectMonthsElapsed(Math.max(0, months));

        // Fetch all revenue data for project lifetime
        const revenueParams = new URLSearchParams({
          start: "0",
          length: "10000",
          search: "",
          sortBy: "renewed_on",
          sortDir: "desc",
          fdate: projectStartStr,
          tdate: nowStr,
          groupId: rabProject.mixRadiusGroupId!,
        });

        const [revenueRes, specificExpRes, generalExpRes] = await Promise.all([
          fetch(`/api/integrations/mixradius/reports/period?${revenueParams}`),
          fetch(
            `/api/finance/expenses?startDate=${projectStartStr}&endDate=${nowStr}&mixRadiusGroupId=${rabProject.mixRadiusGroupId}`,
          ),
          fetch(
            `/api/finance/expenses?startDate=${projectStartStr}&endDate=${nowStr}&scope=general`,
          ),
        ]);

        let roi = {
          revenue: 0,
          sellerFee: 0,
          gatewayFee: 0,
          capexFromRab: 0,
          capexUmum: 0,
          opexAktual: 0,
          opexUmum: 0,
          opexProyeksi: 0,
          depreciation: 0,
          totalExpenses: 0,
          operatingProfit: 0,
        };

        if (revenueRes.ok) {
          const revenueData = await revenueRes.json();
          const specificJson = specificExpRes.ok
            ? await specificExpRes.json()
            : [];
          const generalJson = generalExpRes.ok
            ? await generalExpRes.json()
            : [];

          if (revenueData.success && revenueData.data) {
            const summaryData = revenueData.data.summary;
            const records = revenueData.data.data as IncomePeriodRecord[];

            roi = calculateIncomePeriodCumulativeRoi({
              summaryProfit: summaryData?.profit ?? 0,
              summarySellerFee: summaryData?.feeSeller ?? 0,
              records: records || [],
              feeConfig,
              specificExpenses: Array.isArray(specificJson)
                ? (specificJson as IncomePeriodExpenseItem[])
                : [],
              generalExpenses: Array.isArray(generalJson)
                ? (generalJson as IncomePeriodExpenseItem[])
                : [],
              rabItems: rabProject.items,
              months,
              totalGroups: groups.length || 1,
            });
          }
        }

        setCumulativeRevenue(roi.revenue);
        setCumulativeSellerFee(roi.sellerFee);
        setCumulativeGatewayFee(roi.gatewayFee);
        setCumCapexFromRab(roi.capexFromRab);
        setCumCapexUmum(roi.capexUmum);
        setCumOpexAktual(roi.opexAktual);
        setCumOpexUmum(roi.opexUmum);
        setCumOpexProyeksi(roi.opexProyeksi);
        setCumDepreciation(roi.depreciation);
        setCumulativeExpenses(roi.totalExpenses);
        setCumulativeNetIncome(roi.operatingProfit);
      } catch (err) {
        console.error("Error calculating ROI:", err);
      } finally {
        setRoiLoading(false);
      }
    };

    const timer = setTimeout(() => {
      calcROI();
    }, 500);
    return () => clearTimeout(timer);
  }, [rabProject, calculateNetIncome, parseNumber, groups.length]);

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
      console.error(e);
      toast.error("Terjadi kesalahan");
    }
  };

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
      setGlobalTotal(responseData.recordsTotal || 0);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      toast.loading("Menyiapkan data export...", { id: "export" });

      const params = new URLSearchParams({
        start: "0",
        length: "10000", // Fetch all for export
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
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  // Calculate Projection Metrics
  const isDeficit = netIncome < 0;
  const shortfall = Math.abs(netIncome);
  // Estimate transactions needed to break even: Shortfall / Average Revenue (Net) per user
  // We use Gross ARPU estimate (Profit / Total Records) to be safer, or Net ARPU.
  // Using Net ARPU is more accurate for "how many MORE users to cover expenses".
  // If Net ARPU is negative (which it is in deficit), we can't divide by it directly for projection.
  // Instead, let's use the Gross Average Profit (Revenue - Fees) per user to see how much each new user contributes to covering fixed costs.
  const grossProfit =
    parseNumber(summary?.profit) -
    parseNumber(summary?.feeSeller) -
    estGatewayFee;
  const contributionMarginPerUser =
    totalRecords > 0 ? grossProfit / totalRecords : 0;
  const neededTrxToBreakEven =
    isDeficit && contributionMarginPerUser > 0
      ? Math.ceil(shortfall / contributionMarginPerUser)
      : 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSort = (column: string, direction: "asc" | "desc") => {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(0);
  };

  const handleSyncCommission = async (
    mitra: MitraSale,
    amount: number,
    activeCount: number,
  ) => {
    if (amount <= 0) {
      toast.error("Tidak ada komisi yang perlu disinkronisasi");
      return;
    }

    const periodKey = `${startDate.substring(0, 7)}`;
    const timestamp = new Date().getTime();
    const referenceId = `PAYOUT-FEE-${periodKey}-${mitra.id}-${timestamp}`;

    setSyncingMitra(mitra.id);
    try {
      const res = await fetch("/api/admin/mitra/sync-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mitraId: mitra.id,
          amount,
          referenceId,
          description: `Sync Komisi Pelanggan Berbayar Periode ${periodKey} (+${activeCount} Pelanggan)`,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(
          `Berhasil sinkronisasi komisi ${mitra.name} sebesar ${formatCurrency(amount)}`,
        );
        // Refresh payouts to update UI
        const payoutRes = await fetch(
          "/api/admin/mitra/transactions?type=EARNING&limit=1000",
        );
        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          if (
            payoutData.success &&
            Array.isArray(payoutData.data?.transactions)
          ) {
            setPayouts(payoutData.data.transactions);
          }
        }
      } else {
        toast.error(result.message || "Gagal sinkronisasi komisi");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setSyncingMitra(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-blue-500" />
            Laporan Pendapatan (MixRadius)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Data pendapatan per periode dari server MixRadius
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFeeModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <HiOutlineCog className="w-5 h-5" />
            Config Fee
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiOutlineArrowPath
              className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </div>
      {/* Filters & Search - Toolbar Style matching MixRadiusClient */}
      <div className="flex flex-col xl:flex-row gap-2 xl:items-center">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2">
            <span className="text-xs text-gray-500 font-medium">Periode:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
            />
          </div>

          {/* Service Type */}
          {/* Service Type */}
          <select
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
          >
            <option value="">Semua Layanan</option>
            <option value="PPP">PPP / PPPoE</option>
            <option value="HOTSPOT">Hotspot</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
          >
            <option value="">Semua Metode</option>
            <option value="manual">Manual</option>
            <option value="online">Online</option>
          </select>

          {/* Management Site (Group) Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setSelectedProject(""); // Clear project when manually changing group
              setPage(0);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
          >
            <option value="all">Semua Site</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          {/* RAB Project Filter */}
          {rabProjects.length > 0 && (
            <select
              value={selectedProject}
              onChange={(e) => handleProjectSelect(e.target.value)}
              className="border border-purple-300 dark:border-purple-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[160px]"
            >
              <option value="">Pilih Proyek RAB</option>
              {rabProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}{" "}
                  {project.mixRadiusGroup
                    ? `(${project.mixRadiusGroup.name})`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full xl:w-64">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari Invoice, User, Nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <NPLSummary groupId={selectedGroup} />

      {/* RAB Project Comparison & ROI Tracking Section */}
      {selectedGroup && selectedGroup !== "all" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiOutlineCalculator className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {rabProject
                  ? "Proyeksi RAB & ROI Tracking"
                  : "Proyeksi RAB vs Aktual"}
              </h3>
              {rabProject && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    rabProject.status === "APPROVED"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : rabProject.status === "DRAFT"
                        ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                  }`}
                >
                  {rabProject.status}
                </span>
              )}
            </div>
            {(rabLoading || roiLoading) && (
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {rabProject ? (
            (() => {
              const {
                totalOpexItems,
                totalCapex,
                roiPercent,
                bepReached,
                bepProgress,
                revenueProgressWidth,
                opexStatus,
                opexVariancePercent,
                estimatedBepMonthsRemaining,
              } = calculateIncomePeriodRoiDisplayMetrics({
                rabItems: rabProject.items,
                totalExpenses,
                projectedRevenue: rabProject.projectedRevenue,
                projectedOpex: rabProject.projectedOpex,
                currentProfit: parseNumber(summary?.profit || 0),
                cumulativeNetIncome,
                cumCapexFromRab,
                cumCapexUmum,
                projectMonthsElapsed,
              });
              const {
                currentProfit,
                capexItemCount,
                targetSubscribersProgressPercent,
                targetSubscribersProgressWidth,
                targetSubscribersProgressTone,
              } = calculateIncomePeriodSelectedPeriodMetrics({
                summaryProfit: summary?.profit || 0,
                totalRecords,
                targetSubscribers: rabProject.targetSubscribers,
                rabItems: rabProject.items,
              });

              // Laba Operasional sudah dihitung di state (cumulativeNetIncome)
              // ROI = (Laba Operasional - Total CAPEX) / Total CAPEX × 100
              // BEP = Laba Operasional >= Total CAPEX
              // BEP Progress = berapa % investasi sudah terbayar dari laba operasional
              const targetSubscribersProgressBarClass =
                targetSubscribersProgressTone === "full"
                  ? "bg-green-500"
                  : targetSubscribersProgressTone === "mid"
                    ? "bg-yellow-500"
                    : "bg-indigo-500";

              return (
                <div className="p-5 space-y-5">
                  {/* Project Header */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <HiOutlineClipboardDocumentList className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {rabProject.name}
                      </span>
                    </div>
                    {rabProject.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                        {rabProject.description}
                      </p>
                    )}
                  </div>

                  {/* Period Metrics (Current Filter) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      Periode Terpilih — Aktual vs Proyeksi
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Target Subscribers */}
                      <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
                        <div className="flex items-center gap-2 mb-2">
                          <HiOutlineUsers className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Target vs Aktual
                          </span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {totalRecords.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            /{" "}
                            {rabProject.targetSubscribers?.toLocaleString() ||
                              "-"}
                          </span>
                        </div>
                        {rabProject.targetSubscribers &&
                          rabProject.targetSubscribers > 0 && (
                            <div className="mt-2">
                              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${targetSubscribersProgressBarClass}`}
                                  style={{
                                    width: `${targetSubscribersProgressWidth}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {targetSubscribersProgressPercent.toFixed(1)}%
                                tercapai
                              </p>
                            </div>
                          )}
                      </div>

                      {/* Revenue vs Projection */}
                      <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 rounded-lg p-4 border border-green-100 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <HiOutlineCurrencyDollar className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Pendapatan vs Proyeksi
                          </span>
                        </div>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(currentProfit)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Proyeksi:{" "}
                          {formatCurrency(rabProject.projectedRevenue)}
                        </p>
                        {rabProject.projectedRevenue > 0 && (
                          <div className="mt-2">
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  revenueProgressWidth >= 100
                                    ? "bg-green-500"
                                    : "bg-green-400"
                                }`}
                                style={{ width: `${revenueProgressWidth}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CAPEX */}
                      <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                        <div className="flex items-center gap-2 mb-2">
                          <HiOutlineChartBar className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            CAPEX (Investasi Awal)
                          </span>
                        </div>
                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(totalCapex)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {capexItemCount} item
                          {totalOpexItems > 0 &&
                            ` + OPEX: ${formatCurrency(totalOpexItems)}/bln`}
                        </p>
                      </div>

                      {/* OPEX vs Projection */}
                      <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 rounded-lg p-4 border border-orange-100 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-2">
                          <HiOutlineArrowTrendingDown className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            OPEX Aktual vs Proyeksi
                          </span>
                        </div>
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {formatCurrency(totalExpenses)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Proyeksi: {formatCurrency(rabProject.projectedOpex)}
                          /bln
                        </p>
                        {rabProject.projectedOpex > 0 && (
                          <p
                            className={`text-xs mt-1 font-medium ${
                              opexStatus === "under"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {opexStatus === "under"
                              ? `Di bawah anggaran (${opexVariancePercent.toFixed(1)}%)`
                              : `Melebihi anggaran (${opexVariancePercent.toFixed(1)}%)`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ROI Tracking Section (Cumulative - Lifetime) */}
                  {rabProject.startDate && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <HiOutlineBanknotes className="w-4 h-4 text-emerald-500" />
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          ROI Tracking — Sejak{" "}
                          {new Date(rabProject.startDate).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "long", year: "numeric" },
                          )}{" "}
                          ({projectMonthsElapsed} bulan)
                        </p>
                        {roiLoading && (
                          <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Cumulative Revenue (using profit = same as Pendapatan vs Proyeksi) */}
                        <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Kumulatif Pendapatan
                          </span>
                          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {formatCurrency(cumulativeRevenue)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Profit dari MixRadius (sejak proyek dimulai)
                          </p>
                          {cumulativeGatewayFee > 0 && (
                            <p className="text-[10px] text-gray-400 flex justify-between mt-0.5">
                              <span>Est. Fee Gateway:</span>
                              <span className="text-red-400">
                                -{formatCurrency(cumulativeGatewayFee)}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Total Investasi (CAPEX) */}
                        <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Total Investasi (CAPEX)
                          </span>
                          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                            {formatCurrency(totalCapex)}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-[10px] text-gray-400 flex justify-between">
                              <span>CAPEX RAB Proyek:</span>
                              <span className="font-medium">
                                {formatCurrency(cumCapexFromRab)}
                              </span>
                            </p>
                            {cumCapexUmum > 0 && (
                              <p className="text-[10px] text-gray-400 flex justify-between">
                                <span>CAPEX Umum (alokasi):</span>
                                <span className="font-medium">
                                  {formatCurrency(cumCapexUmum)}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Biaya Operasional (OPEX) */}
                        <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 rounded-lg p-4 border border-red-100 dark:border-red-800">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Biaya Operasional
                          </span>
                          <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                            {formatCurrency(cumulativeExpenses)}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {cumOpexProyeksi > 0 && (
                              <p className="text-[10px] text-gray-400 flex justify-between">
                                <span>
                                  OPEX RAB ({projectMonthsElapsed || 1} bln):
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(cumOpexProyeksi)}
                                </span>
                              </p>
                            )}
                            {cumOpexAktual > 0 && (
                              <p className="text-[10px] text-gray-400 flex justify-between">
                                <span>Pengeluaran tambahan:</span>
                                <span className="font-medium">
                                  {formatCurrency(cumOpexAktual)}
                                </span>
                              </p>
                            )}
                            {cumOpexUmum > 0 && (
                              <p className="text-[10px] text-gray-300 dark:text-gray-500 flex justify-between pl-2">
                                <span>
                                  (termasuk umum: {formatCurrency(cumOpexUmum)})
                                </span>
                              </p>
                            )}
                            {cumDepreciation > 0 && (
                              <p className="text-[10px] text-gray-400 flex justify-between">
                                <span>Depresiasi:</span>
                                <span className="font-medium">
                                  {formatCurrency(cumDepreciation)}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Cumulative Net Income */}
                        <div
                          className={`bg-gradient-to-br rounded-lg p-4 border ${
                            cumulativeNetIncome >= 0
                              ? "from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 border-emerald-100 dark:border-emerald-800"
                              : "from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border-red-100 dark:border-red-800"
                          }`}
                        >
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Laba Operasional
                          </span>
                          <p
                            className={`text-xl font-bold mt-1 ${
                              cumulativeNetIncome >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(cumulativeNetIncome)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Pendapatan - Fee - Biaya Operasional
                          </p>
                        </div>

                        {/* ROI Percentage */}
                        <div
                          className={`bg-gradient-to-br rounded-lg p-4 border ${
                            roiPercent >= 100
                              ? "from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border-green-100 dark:border-green-800"
                              : roiPercent >= 0
                                ? "from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-100 dark:border-blue-800"
                                : "from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border-red-100 dark:border-red-800"
                          }`}
                        >
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            ROI
                          </span>
                          <p
                            className={`text-xl font-bold mt-1 ${
                              roiPercent >= 100
                                ? "text-green-600 dark:text-green-400"
                                : roiPercent >= 0
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {totalCapex > 0 ? `${roiPercent.toFixed(1)}%` : "-"}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {totalCapex > 0
                              ? `(Laba Operasional - CAPEX) / CAPEX`
                              : "Tidak ada CAPEX"}
                          </p>
                        </div>
                      </div>

                      {/* BEP Progress Bar */}
                      {totalCapex > 0 && (
                        <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {bepReached ? (
                                <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <HiOutlineXCircle className="w-5 h-5 text-yellow-500" />
                              )}
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {bepReached
                                  ? "BEP Tercapai!"
                                  : "Progress Menuju BEP"}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-bold ${bepReached ? "text-green-600" : "text-yellow-600"}`}
                            >
                              {bepProgress.toFixed(1)}%
                            </span>
                          </div>

                          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                bepReached
                                  ? "bg-gradient-to-r from-green-400 to-green-500"
                                  : bepProgress >= 50
                                    ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                                    : "bg-gradient-to-r from-blue-400 to-blue-500"
                              }`}
                              style={{ width: `${Math.max(bepProgress, 0)}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Investasi: {formatCurrency(totalCapex)}</span>
                            <span>
                              Laba Operasional:{" "}
                              {formatCurrency(Math.max(0, cumulativeNetIncome))}
                            </span>
                            {!bepReached &&
                              estimatedBepMonthsRemaining !== null && (
                                <span className="text-blue-500 font-medium">
                                  Est. BEP: ~{estimatedBepMonthsRemaining} bulan
                                  lagi
                                </span>
                              )}
                            {!bepReached && cumulativeNetIncome <= 0 && (
                              <span className="text-red-500 font-medium">
                                Belum bisa estimasi BEP
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Growth Info */}
                      {rabProject.growthType &&
                        rabProject.targetSubscribers && (
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-3">
                            <div className="flex items-center gap-1">
                              <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-400" />
                              <span>
                                Model:{" "}
                                <strong className="text-gray-700 dark:text-gray-300">
                                  {rabProject.growthType}
                                </strong>
                              </span>
                            </div>
                            {rabProject.arpu && (
                              <div className="flex items-center gap-1">
                                <span>
                                  ARPU:{" "}
                                  <strong className="text-gray-700 dark:text-gray-300">
                                    {formatCurrency(rabProject.arpu)}
                                  </strong>
                                </span>
                              </div>
                            )}
                            {rabProject.startDate && (
                              <div className="flex items-center gap-1">
                                <HiOutlineCalendar className="w-4 h-4" />
                                <span>
                                  Mulai:{" "}
                                  <strong className="text-gray-700 dark:text-gray-300">
                                    {new Date(
                                      rabProject.startDate,
                                    ).toLocaleDateString("id-ID")}
                                  </strong>
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* No startDate - show hint */}
                  {!rabProject.startDate && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
                        <HiOutlineInformationCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            ROI Tracking belum tersedia
                          </p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Atur tanggal mulai proyek di RAB untuk mengaktifkan
                            ROI tracking kumulatif dan progress BEP.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : !rabLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <HiOutlineCalculator className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium">Belum ada RAB untuk site ini</p>
              <p className="text-sm mt-1">
                Buat RAB di menu Pengeluaran &gt; RAB (Proyek) untuk melihat
                perbandingan
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            PROFIT (IDR)
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {summary?.profit || "0"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            FEE SELLER (IDR)
          </p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {summary?.feeSeller || "0"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {isCalculatingNet && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              FEE GATEWAY (EST)
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowFeeModal(true)}
            >
              <HiOutlineCog className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {formatCurrency(estGatewayFee)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-visible">
          {isCalculatingNet && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 rounded-xl">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              PENGELUARAN (SITE)
            </p>

            {/* Tooltip Info Calculation */}
            <div className="group relative">
              <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />

              <div className="absolute bottom-full mb-2 right-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700 translate-y-2 group-hover:translate-y-0 duration-200">
                <div className="space-y-2">
                  <div className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-2">
                    Rincian Perhitungan
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        SITE
                      </span>
                      Langsung:
                    </span>
                    <span className="font-mono">
                      {formatCurrency(specificExpenses)}
                    </span>
                  </div>

                  {allocatedExpenses > 0 ? (
                    <>
                      <div className="flex justify-between items-center text-yellow-300">
                        <span className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            UMUM
                          </span>
                          Alokasi Pusat:
                        </span>
                        <span className="font-mono">
                          + {formatCurrency(allocatedExpenses)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 italic mt-1 leading-tight ml-1 pl-2 border-l-2 border-gray-700">
                        *Alokasi Pusat dihitung berdasarkan bobot kontribusi
                        (Rata-rata Rasio Transaksi & Profit) site ini terhadap
                        global.
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic mt-1">
                      *Tidak ada alokasi biaya umum/pusat
                    </p>
                  )}

                  <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between items-center font-bold text-sm">
                    <span>Total Beban:</span>
                    <span className="text-orange-400">
                      {formatCurrency(totalExpenses)}
                    </span>
                  </div>
                </div>
                {/* Arrow */}
                <div className="absolute top-full right-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>

          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {formatCurrency(totalExpenses)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            TOTAL + PPN (IDR)
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {summary?.totalPlusPpn || "0"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            TOTAL TRANSAKSI
          </p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {summary?.totalTransactions || totalRecords.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-visible bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          {isCalculatingNet && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 rounded-xl">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                PENDAPATAN BERSIH (EST)
              </p>
              {/* Tooltip Net Calculation */}
              <div className="group relative">
                <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />

                <div className="absolute bottom-full mb-2 left-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700 translate-y-2 group-hover:translate-y-0 duration-200">
                  <div className="space-y-2">
                    <div className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-2">
                      Rincian Perhitungan Bersih
                    </div>

                    <div className="flex justify-between items-center text-green-300">
                      <span>Profit (Pendapatan):</span>
                      <span className="font-mono font-bold">
                        {summary?.profit || "0"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-red-300">
                      <span>- Fee Seller (Komisi):</span>
                      <span className="font-mono">
                        {summary?.feeSeller ? `(${summary.feeSeller})` : "0"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-red-300">
                      <span>- Fee Gateway (Admin):</span>
                      <span className="font-mono">
                        ({formatCurrency(estGatewayFee)})
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-orange-300 border-b border-gray-700 pb-2 mb-2">
                      <span>- Total Pengeluaran:</span>
                      <span className="font-mono">
                        ({formatCurrency(totalExpenses)})
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-sm">
                      <span>Pendapatan Bersih:</span>
                      <span className="text-emerald-400">
                        {formatCurrency(netIncome)}
                      </span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowFeeModal(true)}
            >
              <HiOutlineCog className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(netIncome)}
          </p>
          <div className="flex flex-col gap-0.5 mt-1">
            <p className="text-[10px] text-gray-400 flex justify-between">
              <span>Est. Potongan Gateway:</span>
              <span className="text-red-400 font-medium">
                -{formatCurrency(estGatewayFee)}
              </span>
            </p>
            <p className="text-[10px] text-gray-400 flex justify-between">
              <span>Pengeluaran Site:</span>
              <span className="text-red-400 font-medium">
                -{formatCurrency(specificExpenses)}
              </span>
            </p>
            {allocatedExpenses > 0 && (
              <p className="text-[10px] text-gray-400 flex justify-between">
                <span>Alokasi Pengeluaran Umum:</span>
                <span className="text-red-400 font-medium">
                  -{formatCurrency(allocatedExpenses)}
                </span>
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1 italic border-t border-gray-100 dark:border-gray-700 pt-1">
              *Net setelah pot. Fee, Gateway & Total Pengeluaran
            </p>
          </div>
        </div>

        {/* Net ARPU Card */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-visible hover:z-20 transition-all duration-200 col-span-1 sm:col-span-2">
          {isCalculatingNet && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 rounded-xl">
              <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                NET ARPU (EST)
              </p>
              <div className="group relative">
                <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
                <div className="absolute top-full mt-2 left-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700 translate-y-[-10px] group-hover:translate-y-0 duration-200">
                  <div className="space-y-2">
                    <div className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-2">
                      Average Revenue Per User (Net)
                    </div>
                    <p className="text-gray-400">
                      Rata-rata pendapatan bersih yang diperoleh dari setiap
                      pelanggan/transaksi aktif pada periode ini.
                    </p>
                    <div className="bg-gray-800 p-2 rounded border border-gray-700 font-mono text-[10px] text-center mt-2">
                      Net Income / Total Transaksi
                    </div>
                  </div>
                  <div className="absolute bottom-full left-1 border-4 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
            {totalRecords > 0
              ? formatCurrency(Math.floor(netIncome / totalRecords))
              : "Rp 0"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Per user/transaksi aktif
          </p>
        </div>

        {/* Projection / Status Card - New Addition */}
        <div
          className={`p-5 rounded-xl border shadow-sm relative overflow-visible col-span-1 sm:col-span-2 ${
            isDeficit
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          }`}
        >
          {isCalculatingNet && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 rounded-xl">
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-bold uppercase ${isDeficit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {isDeficit ? "STATUS: DEFISIT" : "STATUS: SURPLUS"}
              </p>
              {/* Tooltip Projection */}
              <div className="group relative">
                <HiOutlineInformationCircle
                  className={`w-5 h-5 cursor-help transition-colors ${isDeficit ? "text-red-400 hover:text-red-600" : "text-emerald-400 hover:text-emerald-600"}`}
                />
                <div className="absolute top-full mt-2 right-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700 translate-y-[-10px] group-hover:translate-y-0 duration-200">
                  <div className="space-y-2">
                    <div className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-2">
                      Analisa & Proyeksi
                    </div>
                    {isDeficit ? (
                      <>
                        <p className="text-gray-300">
                          Saat ini operasional mengalami kerugian (Defisit).
                        </p>
                        <div className="bg-red-900/50 p-2 rounded border border-red-800 mt-2">
                          <p className="font-bold text-red-200 mb-1">
                            Target Balik Modal:
                          </p>
                          <p className="text-gray-400 leading-relaxed">
                            Anda perlu menambah pendapatan sebesar{" "}
                            <span className="text-white font-bold">
                              {formatCurrency(shortfall)}
                            </span>{" "}
                            untuk menutupi biaya operasional.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-300">
                          Operasional berjalan sehat dengan keuntungan
                          (Surplus).
                        </p>
                        <p className="text-emerald-300 mt-1">
                          *Pertahankan atau tingkatkan transaksi untuk
                          memperbesar margin.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="absolute bottom-full right-1 border-4 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
            {isDeficit ? (
              <HiOutlineArrowTrendingDown className="w-6 h-6 text-red-500" />
            ) : (
              <HiOutlineArrowTrendingUp className="w-6 h-6 text-emerald-500" />
            )}
          </div>

          <div className="mt-1">
            {isDeficit ? (
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  -{formatCurrency(shortfall)}
                </p>
                {neededTrxToBreakEven > 0 && contributionMarginPerUser > 0 ? (
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-medium flex items-center gap-1">
                    <span>🎯 Kejar target:</span>
                    <span className="bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded text-red-700 dark:text-red-200 font-bold border border-red-200 dark:border-red-800">
                      +{neededTrxToBreakEven} Transaksi
                    </span>
                    <span>lagi</span>
                  </p>
                ) : (
                  <p className="text-xs text-red-500 mt-1">
                    Perlu efisiensi biaya / genjot omzet
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  Safe Margin
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                  Keuntungan bersih operasional aman.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mitra Sales Summary Section */}
      {mitraSales.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              <HiOutlineUsers className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Ringkasan Komisi Mitra Sales
              </h3>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Periode:{" "}
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {startDate}
              </span>{" "}
              s/d{" "}
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {endDate}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-6 py-3">Nama Mitra</th>
                  <th className="px-6 py-3">Owner MixRadius</th>
                  <th className="px-6 py-3 text-center">
                    Pelanggan Aktif (T-1)
                  </th>
                  <th className="px-6 py-3 text-right">Rate Fee</th>
                  <th className="px-6 py-3 text-right">Total Komisi Settled</th>
                  <th className="px-6 py-3 text-center">Status / Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {mitraSales.map((mitra) => {
                  // Filter globalRecords to match this mitra's owners
                  const activeCount = globalRecords.filter((record) =>
                    mitra.mixradiusOwnerNames.some((owner) =>
                      record.owner_name
                        ?.toLowerCase()
                        .includes(owner.toLowerCase()),
                    ),
                  ).length;

                  const totalPotentialFee =
                    activeCount * (mitra.mitraRateFeePelanggan || 0);
                  const periodKey = `${startDate.substring(0, 7)}`;

                  // Calculate already synced for this mitra and month
                  const syncedAmount = payouts
                    .filter(
                      (tx) =>
                        tx.referenceId?.startsWith(
                          `PAYOUT-FEE-${periodKey}-${mitra.id}-`,
                        ) ||
                        tx.referenceId ===
                          `PAYOUT-FEE-${periodKey}-${mitra.id}`,
                    )
                    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

                  const remainingFee = Math.max(
                    0,
                    totalPotentialFee - syncedAmount,
                  );
                  const isFullyPaid =
                    remainingFee <= 0 && totalPotentialFee > 0;

                  return (
                    <tr
                      key={mitra.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {mitra.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {mitra.mixradiusOwnerNames.map((owner, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-[10px]"
                            >
                              {owner}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900 dark:text-white">
                        {activeCount}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {formatCurrency(mitra.mitraRateFeePelanggan || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(totalPotentialFee)}
                          </span>
                          {syncedAmount > 0 && (
                            <span className="text-[10px] text-green-500 font-medium">
                              Synced: -{formatCurrency(syncedAmount)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isFullyPaid ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-bold">
                              <HiOutlineCheckCircle className="w-4 h-4" />
                              FULL SYNCED
                            </span>
                            <span className="text-[10px] text-gray-400">
                              Semua komisi periode ini sudah dipindah
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {remainingFee > 0 && syncedAmount > 0 && (
                              <span className="text-xs font-bold text-orange-500">
                                Sisa: {formatCurrency(remainingFee)}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                handleSyncCommission(
                                  mitra,
                                  remainingFee,
                                  activeCount,
                                )
                              }
                              disabled={
                                syncingMitra === mitra.id ||
                                remainingFee <= 0 ||
                                isCalculatingNet
                              }
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                              {syncingMitra === mitra.id ? (
                                <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                              ) : (
                                <HiOutlineArrowPath className="w-4 h-4" />
                              )}
                              Sync Sisa ke Wallet
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FeeConfigurationModal
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        currentFees={feeConfig}
        onSave={handleSaveFees}
        availableMethods={Array.from(
          new Set(data.map((d) => d.payment_method || d.method)),
        ).filter(Boolean)}
      />

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div>
          <ResponsiveTable
            data={data}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            columns={[
              {
                key: "invoice",
                header: "Invoice",
                priority: "primary",
                sortable: true,
                render: (item) => (
                  <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                    {item.invoice}
                  </span>
                ),
              },
              {
                key: "member_id",
                header: "ID Pelanggan",
                priority: "secondary",
                sortable: true,
                render: (item) => {
                  let displayId = "n/a";
                  const isMember = item.method === "MEMBER";

                  if (item.member_id === "0") {
                    displayId = "n/a";
                  } else if (isMember) {
                    displayId = item.member_id;
                  } else {
                    displayId = item.username;
                  }

                  return (
                    <span
                      className={`text-sm ${isMember ? "font-mono font-bold" : ""} text-gray-900 dark:text-white`}
                    >
                      {displayId}
                    </span>
                  );
                },
              },
              {
                key: "fullname",
                header: "Nama",
                priority: "primary",
                sortable: true,
                render: (item) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.fullname}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {item.username}
                    </span>
                  </div>
                ),
              },
              {
                key: "nasporttype",
                header: "Tipe Service",
                priority: "secondary",
                sortable: true,
                render: (item) => {
                  const isPrepaid = item.payment_type === "PREPAID";
                  const typeLabel = isPrepaid ? "PRE" : "POST";
                  const typeClass = isPrepaid
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

                  let serviceName = "HOTSPOT";
                  if (item.nasporttype === "Ethernet") serviceName = "PPPOE";
                  else if (item.nasporttype === "Virtual")
                    serviceName = "PPTP/L2TP";
                  else if (item.nasporttype === "Async")
                    serviceName = "OVPN/SSTP";

                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${typeClass}`}
                      >
                        {typeLabel}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {serviceName}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "plan_name",
                header: "Paket Langganan",
                priority: "secondary",
                sortable: true,
              },
              {
                key: "total",
                header: "Harga [ +PPN ]",
                priority: "primary",
                sortable: true,
                render: (item) => (
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(item.total)}
                  </span>
                ),
              },
              {
                key: "seller_fee",
                header: "Fee Seller",
                priority: "tertiary",
                sortable: true,
                render: (item) => (
                  <span className="text-gray-500 dark:text-gray-400">
                    {parseInt(String(item.seller_fee)) > 0
                      ? formatCurrency(item.seller_fee)
                      : "-"}
                  </span>
                ),
              },
              {
                key: "renewed_on",
                header: "Tanggal Aktif",
                priority: "secondary",
                sortable: true,
                render: (item) => (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <HiOutlineCalendar className="w-4 h-4" />
                    {formatDate(item.renewed_on)}
                  </div>
                ),
              },
              {
                key: "payment_method",
                header: "Metode Bayar",
                priority: "secondary",
                sortable: true,
                render: (item) => {
                  const method = item.payment_method || item.method || "-";
                  const isOnline =
                    method.toLowerCase().includes("dtk") ||
                    method.toLowerCase().includes("tripay") ||
                    method.toLowerCase().includes("midtrans") ||
                    method.toLowerCase().includes("xendit") ||
                    item.payment_type?.toLowerCase() === "online";

                  return (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        isOnline
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {method}
                    </span>
                  );
                },
              },
              {
                key: "owner_name",
                header: "Owner Data",
                priority: "tertiary",
                sortable: true,
                render: (item) => (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <HiOutlineUser className="w-4 h-4" />
                    {item.owner_name}
                  </div>
                ),
              },
            ]}
            keyField="id"
            loading={loading}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <HiOutlineMagnifyingGlass className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                <p>Tidak ada data laporan ditemukan</p>
              </div>
            }
          />
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tampilkan
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setPage(0);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              data
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {page + 1} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
