"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import {
  HiClock,
  HiCheckCircle,
  HiWrenchScrewdriver,
  HiChevronRight,
  HiExclamationCircle,
  HiUserGroup,
  HiChartBar,
  HiBuildingOffice2,
  HiArchiveBoxArrowDown,
  HiChatBubbleLeftRight,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { WoTrendCharts } from "@/components/workorder/dashboard/WoTrendCharts";

type Statistics = {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  onHold: number;
  completed: number;
  verified: number;
  closed: number;
  cancelled: number;
  urgentOpen: number;
  avgCompletionTimeHours: number;
  totalCost: number;
  avgRating: number | null;
  totalWithRating: number;
};
type WorkOrder = {
  id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  contactName?: string | null;
  pelanggan?: { nama: string } | null;
  assignedTo: { name: string } | null;
  department: { name: string } | null;
  site?: { name: string } | null;
  createdAt: string;
};
type DepartmentWorkload = {
  departmentName: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
};
type TopPerformer = {
  userName: string;
  role?: string;
  site?: string;
  count: number;
  avgCompletionTime: number;
};
type IssueStatistic = { issue: string; count: number };
type SiteStatistic = {
  siteName: string;
  count: number;
  mostCommonIssue: string;
};

type DisconnectionStatistic = { reason: string; count: number };
type ResponseStatistic = {
  userId: string;
  userName: string;
  role: string;
  totalScore: number;
  totalResponses: number;
  avgResponseTimeMinutes: number;
  verifiedCount: number;
  avgVerifyTimeMinutes: number;
  completedCount: number;
  canvasingCount: number;
  avgCanvasingTimeMinutes: number;
  isTechnical?: boolean;
};
type AdminKPI = {
  pendingVerification: number;
  avgVerificationTimeMinutes: number;

  avgCanvasingTimeMinutes: number;
  canvasingApprovedToday: number;
  canvasingApprovedThisWeek: number;
};

// Trend Types
type VolumeTrendItem = {
  month: string;
  created: number;
  completed: number;
  requested: number;
};
type IssueTrendItem = {
  month: string;
  issues: Array<{ issue: string; count: number }>;
};
type PerformanceTrendItem = {
  month: string;
  avgCompletionHours: number;
  avgRating: number | null;
  totalCompleted: number;
};
type TypeTrendItem = {
  month: string;
  types: Array<{ type: string; count: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  ASSIGNED:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  IN_PROGRESS:
    "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  COMPLETED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  VERIFIED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  NORMAL: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  HIGH: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  URGENT: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  CRITICAL: "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200",
};

export function ClientComponent() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([]);
  const [departmentWorkload, setDepartmentWorkload] = useState<
    DepartmentWorkload[]
  >([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [topAssists, setTopAssists] = useState<TopPerformer[]>([]);
  const [issueStats, setIssueStats] = useState<IssueStatistic[]>([]);
  const [siteStats, setSiteStats] = useState<SiteStatistic[]>([]);
  const [disconnectionStats, setDisconnectionStats] = useState<
    DisconnectionStatistic[]
  >([]);
  const [responseStats, setResponseStats] = useState<ResponseStatistic[]>([]);
  const [adminKPI, setAdminKPI] = useState<AdminKPI | null>(null);
  const [woTypeStats, setWoTypeStats] = useState<{
    customer: number;
    internal: number;
  } | null>(null);
  const [performancePeriod, setPerformancePeriod] =
    useState<string>("all_time");
  const adminSiteId =
    session?.user?.primarySiteId ??
    session?.user?.siteIds?.[0] ??
    session?.user?.siteId;

  useRealtimeScope({
    kind: "admin",
    id: adminSiteId ? `workorders.site.${adminSiteId}` : "workorders",
  });

  // Trend states
  const [trendStartDate, setTrendStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [trendEndDate, setTrendEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [volumeTrend, setVolumeTrend] = useState<VolumeTrendItem[]>([]);
  const [issueTrend, setIssueTrend] = useState<IssueTrendItem[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<
    PerformanceTrendItem[]
  >([]);
  const [typeTrend, setTypeTrend] = useState<TypeTrendItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      // OPTIMIZED: Single consolidated API call instead of 6 separate calls (Phase 2 optimization)
      const response = await fetch(
        `/api/admin/workorders/dashboard?period=${performancePeriod}`,
      );

      if (response.ok) {
        const result = await response.json();
        const data = result.data;

        // Set all dashboard state from single response
        setStats(data.stats);
        setRecentWorkOrders(data.recentWorkOrders);
        setDepartmentWorkload(data.departmentWorkload);
        setTopPerformers(data.topPerformers);
        setTopAssists(data.topAssists);
        setIssueStats(data.issueStats);
        setSiteStats(data.siteStats);
        setDisconnectionStats(data.disconnectionStats);
        setResponseStats(data.responseStats);
        setAdminKPI(data.adminKPI);
        setWoTypeStats(data.woTypeStats);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [performancePeriod]);

  const fetchDetailedStats = useCallback(async () => {
    // OPTIMIZED: Reuse consolidated endpoint with period parameter
    // Only fetches period-sensitive data (performers, analytics, response stats)
    try {
      const response = await fetch(
        `/api/admin/workorders/dashboard?period=${performancePeriod}`,
      );

      if (response.ok) {
        const result = await response.json();
        const data = result.data;

        // Update only period-sensitive data
        setTopPerformers(data.topPerformers);
        setTopAssists(data.topAssists);
        setIssueStats(data.issueStats);
        setSiteStats(data.siteStats);
        setDisconnectionStats(data.disconnectionStats);
        setResponseStats(data.responseStats);
      }
    } catch (error) {
      console.error("Error fetching detailed stats:", error);
    }
  }, [performancePeriod]);

  const fetchTrendData = useCallback(async () => {
    if (!trendStartDate || !trendEndDate) return;
    setTrendLoading(true);
    try {
      const response = await fetch(
        `/api/admin/workorders/trends?startDate=${trendStartDate}&endDate=${trendEndDate}`,
      );
      if (response.ok) {
        const result = await response.json();
        setVolumeTrend(result.data.volumeTrend || []);
        setIssueTrend(result.data.issueTrend || []);
        setPerformanceTrend(result.data.performanceTrend || []);
        setTypeTrend(result.data.typeTrend || []);
      }
    } catch (error) {
      console.error("Error fetching trend data:", error);
    } finally {
      setTrendLoading(false);
    }
  }, [trendStartDate, trendEndDate]);

  useEffect(() => {
    if (session?.user && status === "authenticated") {
      fetchDashboardData();
      fetchTrendData();
    }
  }, [session, status, fetchDashboardData, fetchTrendData]);

  useEffect(() => {
    if (session?.user && status === "authenticated") {
      fetchDetailedStats();
    }
  }, [performancePeriod, session, status, fetchDetailedStats]);

  // Real-time updates
  const handleUpdate = useCallback(() => {
    if (session?.user && status === "authenticated") {
      fetchDashboardData();
      fetchDetailedStats();
    }
  }, [session, status, fetchDashboardData, fetchDetailedStats]);

  useRealtimeEvent("workorder.new", handleUpdate);
  useRealtimeEvent("workorder.update", handleUpdate);
  useRealtimeEvent("workorder.assigned", handleUpdate);

  if (status === "loading" || loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PageLoader />
      </div>
    );

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };
  const getTimeWaiting = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Work Order Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Overview of all work orders
          </p>
        </div>
        <Link
          href="/admin/workorders/list"
          className="px-4 py-2 bg-sky-600 dark:bg-sky-500 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-400 font-semibold inline-block"
        >
          <span className="text-white">View All Work Orders</span>
        </Link>
      </div>
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/admin/workorders/list?status=PENDING&priority=HIGH,URGENT,CRITICAL"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Urgent Attention
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {stats.urgentOpen || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <HiExclamationCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                High priority & open
              </p>
            </Link>
            <Link
              href="/admin/workorders/list?status=PENDING"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Unassigned
                  </p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {stats.pending}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <HiClock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Waiting for assignment
              </p>
            </Link>
            <Link
              href="/admin/workorders/list?status=IN_PROGRESS,ASSIGNED"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Active Progress
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {stats.assigned + stats.inProgress}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <HiWrenchScrewdriver className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Currently being worked on
              </p>
            </Link>
            <Link
              href="/admin/workorders/list?status=COMPLETED,VERIFIED"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Completed
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {stats.completed + stats.verified}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <HiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Successfully closed
              </p>
            </Link>
          </div>

          {/* WO Type Stats: Customer vs Internal */}
          {woTypeStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/admin/workorders/list?woType=customer"
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-sky-500 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      WO Customer
                    </p>
                    <p className="text-3xl font-bold text-sky-600 dark:text-sky-400 mt-1">
                      {woTypeStats.customer}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
                    <HiUserGroup className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Work order untuk pelanggan
                </p>
              </Link>
              <Link
                href="/admin/workorders/list?woType=internal"
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      WO Internal (FOC)
                    </p>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {woTypeStats.internal}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <HiBuildingOffice2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Work order internal FOC
                </p>
              </Link>
            </div>
          )}

          {/* Admin KPI Section */}
          {adminKPI && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Admin KPI Performance
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Real-time metrics
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Pending Verification */}
                <Link
                  href="/admin/workorders/list?status=COMPLETED"
                  className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    Pending Verification
                  </p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {adminKPI.pendingVerification}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    WO butuh verifikasi
                  </p>
                </Link>

                {/* Avg Verification Time */}
                <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
                  <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">
                    Avg Verify Time
                  </p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-1">
                    {adminKPI.avgVerificationTimeMinutes < 60
                      ? `${adminKPI.avgVerificationTimeMinutes}m`
                      : adminKPI.avgVerificationTimeMinutes < 1440
                        ? `${(adminKPI.avgVerificationTimeMinutes / 60).toFixed(1)}h`
                        : `${(adminKPI.avgVerificationTimeMinutes / 1440).toFixed(1)}d`}
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                    COMPLETED → VERIFIED
                  </p>
                </div>

                {/* Canvasing KPI (Sales) */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    Canvasing Approval
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                    {adminKPI.canvasingApprovedToday}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    Avg Time:{" "}
                    {adminKPI.avgCanvasingTimeMinutes < 60
                      ? `${adminKPI.avgCanvasingTimeMinutes}m`
                      : `${(adminKPI.avgCanvasingTimeMinutes / 60).toFixed(1)}h`}
                  </p>
                </div>

                {/* Sales Approved This Week */}
                <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
                  <p className="text-sm text-pink-600 dark:text-pink-400 font-medium">
                    Sales Approved (Week)
                  </p>
                  <p className="text-2xl font-bold text-pink-700 dark:text-pink-300 mt-1">
                    {adminKPI.canvasingApprovedThisWeek}
                  </p>
                  <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                    Today: {adminKPI.canvasingApprovedToday}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* === TREND ANALYTICS SECTION === */}
          <WoTrendCharts
            volumeTrend={volumeTrend}
            issueTrend={issueTrend}
            performanceTrend={performanceTrend}
            typeTrend={typeTrend}
            loading={trendLoading}
            startDate={trendStartDate}
            endDate={trendEndDate}
            onDateChange={(start, end) => {
              setTrendStartDate(start);
              setTrendEndDate(end);
            }}
            onApply={fetchTrendData}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Work Orders */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Recent Work Orders
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentWorkOrders.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                      No recent work orders
                    </div>
                  ) : (
                    recentWorkOrders.map((wo) => (
                      <Link
                        key={wo.id}
                        href={`/admin/workorders/${wo.id}`}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {wo.workOrderNumber}
                            </p>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[wo.status] || "bg-gray-100 dark:bg-gray-700"}`}
                            >
                              {wo.status.replace("_", " ")}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority] || "bg-gray-100 dark:bg-gray-700"}`}
                            >
                              {wo.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {wo.title}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              {wo.pelanggan?.nama || wo.contactName || "Guest"}
                            </span>
                            {wo.site && (
                              <span>
                                • <span className="font-semibold">Site:</span>{" "}
                                {wo.site.name}
                              </span>
                            )}
                            {wo.assignedTo && (
                              <span>• {wo.assignedTo.name}</span>
                            )}
                            {wo.status === "PENDING" && (
                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                • Waiting: {getTimeWaiting(wo.createdAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <HiChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-4" />
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Issue Statistics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Common Issues
                  </h2>
                  <HiChartBar className="w-5 h-5 text-gray-400" />
                </div>
                <div className="p-6">
                  {issueStats.length > 0 ? (
                    <div className="space-y-4">
                      {issueStats.map((stat, index) => (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {stat.issue.replace("_", " ")}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {stat.count} incidents
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min((stat.count / (issueStats[0]?.count ?? 1)) * 100, 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No issue data available
                    </p>
                  )}
                </div>
              </div>

              {/* Disconnection Statistics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Alasan Penarikan Perangkat
                  </h2>
                  <HiArchiveBoxArrowDown className="w-5 h-5 text-gray-400" />
                </div>
                <div className="p-6">
                  {disconnectionStats.length > 0 ? (
                    <div className="space-y-4">
                      {disconnectionStats.map((stat, index) => (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {stat.reason}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {stat.count} cases
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full"
                              style={{
                                width: `${Math.min((stat.count / (disconnectionStats[0]?.count ?? 1)) * 100, 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No disconnection data available
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Top Performers */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Analytics
                  </h2>
                  <select
                    className="text-xs border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
                    value={performancePeriod}
                    onChange={(e) => setPerformancePeriod(e.target.value)}
                  >
                    <option value="all_time">All Time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <HiUserGroup className="w-5 h-5 text-gray-400" />
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">
                      Top Performers
                    </h3>
                  </div>
                  {topPerformers.length > 0 ? (
                    <div className="space-y-4">
                      {topPerformers.map((performer, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400 shrink-0">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {performer.userName}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {performer.role || "-"}{" "}
                                {performer.site ? `• ${performer.site}` : ""}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {formatHours(performer.avgCompletionTime)} avg
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-sky-600">
                              {performer.count}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              tasks
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No performance data available
                    </p>
                  )}
                </div>

                {/* Top Assists */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <HiUserGroup className="w-5 h-5 text-purple-400" />
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">
                      Top Assists
                    </h3>
                  </div>
                  {topAssists.length > 0 ? (
                    <div className="space-y-4">
                      {topAssists.map((assist, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 shrink-0">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {assist.userName}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {assist.role || "-"}{" "}
                                {assist.site ? `• ${assist.site}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                              {assist.count}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              assists
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No assist data available
                    </p>
                  )}
                </div>

                {/* Response Stats - KPI Per User */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <HiChatBubbleLeftRight className="w-5 h-5 text-teal-400" />
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">
                      User KPI Performance
                    </h3>
                  </div>
                  {responseStats.length > 0 ? (
                    <div className="space-y-3">
                      {/* Show ONLY Technical Users as requested */}
                      {responseStats
                        .filter((s) => s.isTechnical)
                        .slice(0, 10)
                        .map((stat, index) => (
                          <div
                            key={stat.userId || index}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-xs font-bold text-teal-600 dark:text-teal-400 shrink-0">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {stat.userName}
                                    </p>
                                    {stat.isTechnical && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                        THD
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {stat.role}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                  {stat.totalScore}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  pts
                                </p>
                              </div>
                            </div>

                            {/* KPI Metrics Grid */}
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {stat.completedCount > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                                  <p className="text-xs text-green-600 dark:text-green-400">
                                    Completed
                                  </p>
                                  <p className="text-sm font-bold text-green-700 dark:text-green-300">
                                    {stat.completedCount} WO
                                  </p>
                                </div>
                              )}
                              {stat.verifiedCount > 0 && (
                                <div className="bg-teal-50 dark:bg-teal-900/20 rounded p-2">
                                  <p className="text-xs text-teal-600 dark:text-teal-400">
                                    Verified
                                  </p>
                                  <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
                                    {stat.verifiedCount} WO
                                  </p>
                                  <p className="text-xs text-teal-500 dark:text-teal-400">
                                    avg:{" "}
                                    {stat.avgVerifyTimeMinutes < 60
                                      ? `${stat.avgVerifyTimeMinutes}m`
                                      : `${(stat.avgVerifyTimeMinutes / 60).toFixed(1)}h`}
                                  </p>
                                </div>
                              )}
                              {stat.totalResponses > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    First Response
                                  </p>
                                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                    {stat.totalResponses} WO
                                  </p>
                                  <p className="text-xs text-blue-500 dark:text-blue-400">
                                    avg:{" "}
                                    {stat.avgResponseTimeMinutes < 60
                                      ? `${stat.avgResponseTimeMinutes}m`
                                      : `${(stat.avgResponseTimeMinutes / 60).toFixed(1)}h`}
                                  </p>
                                </div>
                              )}
                              {stat.canvasingCount > 0 && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2">
                                  <p className="text-xs text-purple-600 dark:text-purple-400">
                                    Canvasing Appr
                                  </p>
                                  <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                                    {stat.canvasingCount} Sales
                                  </p>
                                  <p className="text-xs text-purple-500 dark:text-purple-400">
                                    avg:{" "}
                                    {stat.avgCanvasingTimeMinutes < 60
                                      ? `${stat.avgCanvasingTimeMinutes}m`
                                      : `${(stat.avgCanvasingTimeMinutes / 60).toFixed(1)}h`}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No KPI data available
                    </p>
                  )}
                </div>

                {/* Site Statistics */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <HiBuildingOffice2 className="w-5 h-5 text-gray-400" />
                    <h3 className="text-md font-medium text-gray-900 dark:text-white">
                      Problematic Sites
                    </h3>
                  </div>
                  {siteStats.length > 0 ? (
                    <div className="space-y-4">
                      {siteStats.map((site, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {site.siteName}
                            </p>
                            <p className="text-xs text-red-500">
                              Top issue: {site.mostCommonIssue}
                            </p>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <span className="text-xs font-bold text-red-600 dark:text-red-400">
                              {site.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No site data available
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
                  Performance Overview
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Avg Completion Time
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatHours(stats.avgCompletionTimeHours)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: "70%" }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Customer Satisfaction
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.avgRating
                          ? `${stats.avgRating.toFixed(1)}/5`
                          : "N/A"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                      {stats.totalWithRating} ratings
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {departmentWorkload.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Department Workload
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departmentWorkload.map((dept) => (
                  <div
                    key={dept.departmentName}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {dept.departmentName}
                      </h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                        {dept.total} total
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-1">
                        <p className="text-orange-600 dark:text-orange-400 font-bold">
                          {dept.pending}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          Pending
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-1">
                        <p className="text-blue-600 dark:text-blue-400 font-bold">
                          {dept.inProgress}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          Active
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded p-1">
                        <p className="text-green-600 dark:text-green-400 font-bold">
                          {dept.completed}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">Done</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
