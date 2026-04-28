"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  HiOutlineArrowLeft,
  HiOutlineBriefcase,
  HiOutlineClock,
  HiOutlineStar,
  HiOutlineCalendarDays,
  HiOutlineUserCircle,
  HiOutlineTrophy,
  HiOutlineDocumentArrowDown,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import type { Range } from "react-date-range";

interface PerformanceData {
  userId: string;
  userName: string;
  userEmail: string;
  workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE";
  attendance: {
    present: number;
    late: number;
    absent: number;
    alpha: number;
    total: number;
  };
  flexibleStats: {
    totalMinutesThisMonth: number;
    totalHoursThisMonth: number;
    daysWorkedThisMonth: number;
    avgHoursPerDay: number;
    targetHoursPerDay: number;
    targetPercentage: number;
  };
  leaves: {
    total: number;
  };
  workOrders: {
    totalAssigned: number;
    completed: number;
    active: number;
    completionRate: number;
    avgRating: number;
    lead: {
      total: number;
      completed: number;
    };
    support: {
      total: number;
      completed: number;
    };
  };
  sales?: {
    approved: number;
    total: number;
    progress: number;
    points: number;
  } | null;
}

export default function UsersCompareClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = useMemo(
    () => searchParams.get("ids")?.split(",").filter(Boolean) || [],
    [searchParams],
  );

  const [performances, setPerformances] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"month" | "all" | "custom">("month");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split("T")[0], // Start of month
    to: new Date().toISOString().split("T")[0],
  });

  const fetchAllPerformances = useCallback(async () => {
    if (ids.length === 0) {
      setError("Tidak ada karyawan yang dipilih untuk dibandingkan.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const dateParams =
        period === "custom"
          ? `&dateFrom=${dateRange.from}&dateTo=${dateRange.to}`
          : `&period=${period}`;

      const results = await Promise.all(
        ids.map(async (id) => {
          const [userRes, perfRes, salesRes] = await Promise.all([
            fetch(`/api/admin/users/${id}`),
            fetch(
              `/api/admin/users/${id}/performance?${dateParams.substring(1)}`,
            ),
            fetch(
              `/api/admin/users/${id}/sales-performance?${dateParams.substring(1)}`,
            ),
          ]);

          if (!userRes.ok || !perfRes.ok)
            throw new Error(`Gagal mengambil data untuk ID: ${id}`);

          const uJson = await userRes.json();
          const perfData = await perfRes.json();
          let salesData = null;

          const userData = uJson.data?.user || uJson.user || uJson.data;

          if (salesRes.ok) {
            const sJson = await salesRes.json();
            if (sJson.data) {
              salesData = {
                approved: sJson.data.canvasing.approved,
                total: sJson.data.canvasing.total,
                progress: sJson.data.canvasing.progress,
                points: sJson.data.points.approvedValue,
              };
            }
          }

          return {
            userId: id,
            userName: userData?.name || "Unknown",
            userEmail: userData?.email || "",
            ...perfData.data,
            sales: salesData,
          } as PerformanceData;
        }),
      );
      setPerformances(results);
    } catch (err: unknown) {
      clientLogger.error("Gagal memuat data perbandingan user", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data perbandingan";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ids, period, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchAllPerformances();
  }, [fetchAllPerformances]);

  // Smooth loading: Only show full loader on initial mount (when no data yet)
  if (loading && performances.length === 0) return <PageLoader />;

  if (error && performances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-red-500 font-medium">{error}</p>
        <Link
          href="/admin/users"
          className="text-indigo-600 hover:underline flex items-center gap-2"
        >
          <HiOutlineArrowLeft /> Kembali ke Daftar Pengguna
        </Link>
      </div>
    );
  }

  const getBest = (category: string) => {
    if (performances.length < 2) return null;
    let bestId = "";
    let maxVal = -Infinity;
    performances.forEach((p) => {
      let val = 0;
      switch (category) {
        case "wo_completed":
          val = p.workOrders.completed;
          break;
        case "wo_rate":
          val = p.workOrders.completionRate;
          break;
        case "wo_rating":
          val = p.workOrders.avgRating;
          break;
        case "attn_present":
          val = p.attendance?.present || 0;
          break;
        case "sales_approved":
          val = p.sales?.approved || 0;
          break;
        case "sales_points":
          val = p.sales?.points || 0;
          break;
      }
      if (val > maxVal) {
        maxVal = val;
        bestId = p.userId;
      }
    });
    return maxVal > 0 ? bestId : null;
  };

  const generatePDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const periodText =
      period === "custom"
        ? `${dateRange.from} s/d ${dateRange.to}`
        : period === "month"
          ? "Bulan Ini"
          : "Semua Waktu";

    const title = `Laporan Perbandingan Kinerja Karyawan - ${periodText}`;

    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 14, 22);

    type TableRow = (
      | string
      | number
      | {
          content: string;
          colSpan?: number;
          styles?: {
            halign?: "left" | "center" | "right";
            fillColor?: [number, number, number];
            fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
          };
        }
    )[];
    const tableBody: TableRow[] = [
      ["Nama Karyawan", ...performances.map((p) => p.userName)],
      ["Email", ...performances.map((p) => p.userEmail)],
      ["Mode Kerja", ...performances.map((p) => p.workingHourMode)],
      [
        {
          content: "WORK ORDERS",
          colSpan: performances.length + 1,
          styles: {
            halign: "center",
            fillColor: [243, 244, 246] as [number, number, number],
            fontStyle: "bold",
          },
        },
      ],
      ["Total Selesai", ...performances.map((p) => p.workOrders.completed)],
      [
        "Sebagai Lead (Selesai/Total)",
        ...performances.map(
          (p) => `${p.workOrders.lead.completed}/${p.workOrders.lead.total}`,
        ),
      ],
      [
        "Support/Bantuan (Selesai/Total)",
        ...performances.map(
          (p) =>
            `${p.workOrders.support.completed}/${p.workOrders.support.total}`,
        ),
      ],
      [
        "Success Rate",
        ...performances.map((p) => `${p.workOrders.completionRate}%`),
      ],
      ["Rating Rata-rata", ...performances.map((p) => p.workOrders.avgRating)],
      [
        {
          content: "KEHADIRAN",
          colSpan: performances.length + 1,
          styles: {
            halign: "center",
            fillColor: [243, 244, 246] as [number, number, number],
            fontStyle: "bold",
          },
        },
      ],
      [
        "Hadir (Hari/Jam)",
        ...performances.map((p) =>
          p.workingHourMode === "FLEXIBLE"
            ? `${p.flexibleStats.totalHoursThisMonth}h`
            : p.attendance.present,
        ),
      ],
      [
        "Terlambat",
        ...performances.map((p) =>
          p.workingHourMode === "FLEXIBLE" ? "-" : p.attendance.late,
        ),
      ],
      [
        "Mangkir / Alpha",
        ...performances.map((p) =>
          p.workingHourMode === "FLEXIBLE"
            ? "-"
            : p.attendance.absent + p.attendance.alpha,
        ),
      ],
      [
        {
          content: "LAINNYA",
          colSpan: performances.length + 1,
          styles: {
            halign: "center",
            fillColor: [243, 244, 246] as [number, number, number],
            fontStyle: "bold",
          },
        },
      ],
      ["Cuti & Izin (Hari)", ...performances.map((p) => p.leaves.total)],
    ];

    // Add Sales if any user has sales data
    if (performances.some((p) => p.sales)) {
      tableBody.push(
        [
          {
            content: "SALES & CANVASING",
            colSpan: performances.length + 1,
            styles: {
              halign: "center",
              fillColor: [243, 244, 246] as [number, number, number],
              fontStyle: "bold",
            },
          },
        ],
        [
          "Canvasing Approved",
          ...performances.map((p) => p.sales?.approved ?? "-"),
        ],
        ["Poin Sales", ...performances.map((p) => p.sales?.points ?? "-")],
      );
    }

    autoTable(doc, {
      startY: 30,
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: {
          fontStyle: "bold",
          fillColor: [249, 250, 251] as [number, number, number],
          cellWidth: 40,
        },
      },
      headStyles: { fillColor: [79, 70, 229] as [number, number, number] },
    });

    doc.save(`Perbandingan_Kinerja_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Top Progress Bar for subtle loading */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden">
          <div className="h-full bg-indigo-600 animate-pulse w-full origin-left"></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Perbandingan Kinerja
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Membandingkan {performances.length} karyawan terpilih
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generatePDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95"
          >
            <HiOutlineDocumentArrowDown className="w-5 h-5" />
            PDF
          </button>

          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex gap-1">
              <button
                onClick={() => setPeriod("month")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === "month" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => setPeriod("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === "all" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
              >
                Semua
              </button>
              <button
                onClick={() => setPeriod("custom")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === "custom" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
              >
                Custom
              </button>
            </div>

            {period === "custom" && (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-left-2">
                <DateRangePicker
                  onChange={(range: Range) => {
                    if (range.startDate && range.endDate) {
                      setDateRange({
                        from: format(range.startDate, "yyyy-MM-dd"),
                        to: format(range.endDate, "yyyy-MM-dd"),
                      });
                    }
                  }}
                  range={{
                    startDate: new Date(dateRange.from),
                    endDate: new Date(dateRange.to),
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 transition-all duration-500 ${loading ? "opacity-50 grayscale-[0.2] pointer-events-none" : "opacity-100"}`}
      >
        <div className="flex gap-6 min-w-max pb-4">
          {performances.map((perf) => (
            <CompareColumn
              key={perf.userId}
              data={perf}
              best={{
                wo_completed: getBest("wo_completed") === perf.userId,
                wo_rate: getBest("wo_rate") === perf.userId,
                wo_rating: getBest("wo_rating") === perf.userId,
                attn_present: getBest("attn_present") === perf.userId,
                sales_approved: getBest("sales_approved") === perf.userId,
                sales_points: getBest("sales_points") === perf.userId,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareColumn({
  data,
  best,
}: {
  data: PerformanceData;
  best: Record<string, boolean>;
}) {
  const isTopWinner = Object.values(best).filter(Boolean).length >= 3;
  return (
    <div className="w-80 flex-shrink-0 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center">
        <div className="relative">
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4 border-2 border-white dark:border-gray-700 shadow-sm overflow-hidden">
            <HiOutlineUserCircle className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          {isTopWinner && (
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-bounce">
              <HiOutlineTrophy className="w-4 h-4" />
            </div>
          )}
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white truncate w-full">
          {data.userName}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-full mb-3">
          {data.userEmail}
        </p>
        <Badge
          variant="default"
          className="text-[10px] uppercase font-bold tracking-wider"
        >
          {data.workingHourMode}
        </Badge>
      </div>

      <MetricSection
        title="Work Orders"
        icon={<HiOutlineBriefcase className="text-purple-500" />}
        color="purple"
      >
        <MetricItem
          label="Total Selesai"
          value={data.workOrders.completed}
          isBest={best.wo_completed}
          icon={<HiOutlineTrophy className="text-yellow-500" />}
        />

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg text-center">
            <p className="text-[9px] text-purple-600 dark:text-purple-400 uppercase font-black">
              Sebagai Lead
            </p>
            <p className="text-base font-black text-gray-900 dark:text-white leading-none">
              {data.workOrders.lead.completed}
            </p>
            <p className="text-[8px] text-gray-400 mt-0.5">
              dari {data.workOrders.lead.total}
            </p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg text-center">
            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase font-black">
              Support/Bantuan
            </p>
            <p className="text-base font-black text-gray-900 dark:text-white leading-none">
              {data.workOrders.support.completed}
            </p>
            <p className="text-[8px] text-gray-400 mt-0.5">
              dari {data.workOrders.support.total}
            </p>
          </div>
        </div>

        <MetricItem
          label="Success Rate"
          value={`${data.workOrders.completionRate}%`}
          isBest={best.wo_rate}
          progress={data.workOrders.completionRate}
        />
        <MetricItem
          label="Rating"
          value={data.workOrders.avgRating}
          isBest={best.wo_rating}
          icon={<HiOutlineStar className="text-orange-400 fill-orange-400" />}
        />
      </MetricSection>

      <MetricSection
        title="Kehadiran"
        icon={<HiOutlineClock className="text-green-500" />}
        color="green"
      >
        {data.workingHourMode === "FLEXIBLE" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-gray-500 uppercase">
                Total Jam
              </span>
              <span className="text-xl font-black text-gray-900 dark:text-white">
                {data.flexibleStats.totalHoursThisMonth}h
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                style={{
                  width: `${Math.min(data.flexibleStats.targetPercentage, 100)}%`,
                }}
                className="h-full bg-green-500"
              />
            </div>
            <p className="text-[10px] font-bold text-green-600 dark:text-green-400 text-center uppercase tracking-tighter">
              {data.flexibleStats.targetPercentage}% dari target
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SmallStat
              label="Hadir"
              value={data.attendance.present}
              color="text-green-600"
              isBest={best.attn_present}
            />
            <SmallStat
              label="Telat"
              value={data.attendance.late}
              color="text-yellow-600"
            />
            <SmallStat
              label="Mangkir"
              value={data.attendance.absent}
              color="text-orange-600"
            />
            <SmallStat
              label="Alpha"
              value={data.attendance.alpha}
              color="text-red-600"
            />
          </div>
        )}
      </MetricSection>

      {data.sales && (
        <MetricSection
          title="Sales & Canvasing"
          icon={<HiOutlineStar className="text-emerald-500" />}
          color="emerald"
        >
          <MetricItem
            label="Approved"
            value={data.sales.approved}
            isBest={best.sales_approved}
            icon={<HiOutlineTrophy className="text-emerald-500" />}
          />
          <MetricItem
            label="Poin"
            value={data.sales.points}
            isBest={best.sales_points}
            icon={<HiOutlineStar className="text-yellow-500 fill-yellow-500" />}
          />
          <div className="mt-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
              <span>Target</span>
              <span>{data.sales.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(data.sales.progress, 100)}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </div>
        </MetricSection>
      )}

      <MetricSection
        title="Cuti & Izin"
        icon={<HiOutlineCalendarDays className="text-orange-500" />}
        color="orange"
      >
        <div className="flex justify-between items-center bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30">
          <span className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">
            Total Off
          </span>
          <span className="text-xl font-black text-orange-600">
            {data.leaves.total}{" "}
            <span className="text-xs font-normal">hari</span>
          </span>
        </div>
      </MetricSection>
    </div>
  );
}

function MetricSection({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-${color}-50/30 dark:bg-${color}-900/10`}
      >
        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
          {icon} {title}
        </h4>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  isBest,
  icon,
  progress,
}: {
  label: string;
  value: string | number;
  isBest?: boolean;
  icon?: React.ReactNode;
  progress?: number;
}) {
  return (
    <div
      className={`space-y-1.5 p-3 rounded-xl transition-all ${isBest ? "bg-yellow-50 dark:bg-yellow-900/10 ring-1 ring-yellow-200 dark:ring-yellow-900/30" : ""}`}
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
          {label}
        </span>
        {isBest && icon}
      </div>
      <div className="text-2xl font-black text-gray-900 dark:text-white flex items-baseline gap-1 leading-none">
        {value}
        {isBest && (
          <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-500 uppercase px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-md ml-1">
            Top
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-indigo-500"
          />
        </div>
      )}
    </div>
  );
}

function SmallStat({
  label,
  value,
  color,
  isBest,
}: {
  label: string;
  value: number;
  color: string;
  isBest?: boolean;
}) {
  return (
    <div
      className={`p-2 rounded-xl text-center border ${isBest ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-900/30" : "bg-gray-50 dark:bg-gray-900/30 border-transparent"}`}
    >
      <p className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mb-0.5">
        {label}
      </p>
      <p className={`text-base font-black ${color} leading-none`}>{value}</p>
      {isBest && (
        <p className="text-[8px] font-bold text-yellow-600 uppercase mt-0.5">
          Top
        </p>
      )}
    </div>
  );
}
