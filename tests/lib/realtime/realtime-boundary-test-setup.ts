import { beforeEach, vi } from "vitest";

export const mockUseState = vi.fn((value: unknown) => [value, vi.fn()]);
export const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
);
const mockUseMemo = vi.fn((factory: () => unknown, _deps?: unknown[]) =>
  factory(),
);
export const mockUseRef = vi.fn((value: unknown) => ({ current: value }));
export const useRealtimeScopeMock = vi.fn();
export const useRealtimeEventMock = vi.fn();
const mockUseDebounce = vi.fn((value: unknown) => value);
export const mockUsePermission = vi.fn(() => ({
  hasPermission: vi.fn(() => true),
}));
const mockUseToast = vi.fn(() => ({ showToast: vi.fn() }));
const mockGetWithAuth = vi.fn();
const mockDeleteWithAuth = vi.fn();
const mockButton = vi.fn(() => null);
const mockResponsiveTable = vi.fn(() => null);
const mockLink = vi.fn(() => null);
const mockImage = vi.fn(() => null);
const mockModal = vi.fn(() => null);
const mockModalFooter = vi.fn(() => null);
const mockDynamic = vi.fn((_loader?: unknown, _options?: unknown) => {
  return function MockDynamicComponent(): null {
    return null;
  };
});
const mockIcon = vi.fn(() => null);
const mockUseRealtime = vi.fn(() => ({
  isConnected: true,
  socket: null as null,
  lastError: null as string | null,
  reconnect: vi.fn(),
}));
export const mockIo = vi.fn(() => ({
  on: vi.fn(),
  disconnect: vi.fn(),
}));
export const fetchMock = vi.fn();
const confirmMock = vi.fn(() => true);
const alertMock = vi.fn();
const reloadMock = vi.fn();
const mockShouldNotifyForChatMessage = vi.fn(() => false);
const mockFormatDistanceToNow = vi.fn(() => "baru saja");
const mockLocale = {};

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: (...args: unknown[]) => mockUseState(...(args as [unknown])),
    useEffect: (...args: unknown[]) =>
      mockUseEffect(...(args as [() => void | (() => void), unknown[]?])),
    useCallback: (...args: unknown[]) =>
      mockUseCallback(
        ...(args as [(...input: unknown[]) => unknown, unknown[]?]),
      ),
    useMemo: (...args: unknown[]) =>
      mockUseMemo(...(args as [() => unknown, unknown[]?])),
    useRef: (...args: unknown[]) => mockUseRef(...(args as [unknown])),
  };
});

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: useRealtimeScopeMock,
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: useRealtimeEventMock,
}));

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: mockUseDebounce,
}));

const mockUseSession = vi.fn(() => ({
  data: {
    user: {
      id: "user-1",
      role: "ADMIN",
      accessAdminPanel: true,
      tenantId: "tenant-1",
      primarySiteId: "site-1",
      siteIds: ["site-1"],
    },
  },
  status: "authenticated",
}));
const mockUseRouter = vi.fn(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
const mockUseParams = vi.fn(() => ({ id: "wo-1" }));

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  useParams: () => mockUseParams(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: mockUsePermission,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: mockUseToast,
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/components/ui/PageLoader", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/components/workorder/AddMaterialModal", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoActionModals", () => ({
  WoActionModals: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoSidebar", () => ({
  WoSidebar: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoActivityTimeline", () => ({
  WoActivityTimeline: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoDiscussionTab", () => ({
  WoDiscussionTab: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoMaterialsTab", () => ({
  WoMaterialsTab: vi.fn(() => null),
}));

vi.mock("@/app/admin/workorders/[id]/components/WoMaterialDetailModal", () => ({
  WoMaterialDetailModal: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoTrendCharts", () => ({
  WoTrendCharts: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoStatCards", () => ({
  WoStatCards: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoCharts", () => ({
  WoCharts: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoAnalyticsCards", () => ({
  WoAnalyticsCards: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoQuickActions", () => ({
  WoQuickActions: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoRecentList", () => ({
  WoRecentList: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDepartmentWorkload", () => ({
  WoDepartmentWorkload: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoTopPerformers", () => ({
  WoTopPerformers: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoIssueStats", () => ({
  WoIssueStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoSiteStats", () => ({
  WoSiteStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoResponseStats", () => ({
  WoResponseStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoAdminKPI", () => ({
  WoAdminKPI: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoTypeStats", () => ({
  WoTypeStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDisconnectionStats", () => ({
  WoDisconnectionStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoPerformanceSection", () => ({
  WoPerformanceSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoTrendSection", () => ({
  WoTrendSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoRecentWorkOrders", () => ({
  WoRecentWorkOrders: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoWorkloadSection", () => ({
  WoWorkloadSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoInsightsSection", () => ({
  WoInsightsSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoKPISection", () => ({
  WoKPISection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoOverviewCards", () => ({
  WoOverviewCards: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoHeader", () => ({
  WoHeader: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoMainSections", () => ({
  WoMainSections: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoSecondarySections", () => ({
  WoSecondarySections: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoRealtimeWidgets", () => ({
  WoRealtimeWidgets: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoSummaryGrid", () => ({
  WoSummaryGrid: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoCardGrid", () => ({
  WoCardGrid: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoLayoutShell", () => ({
  WoLayoutShell: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoMetricsHeader", () => ({
  WoMetricsHeader: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoMetricCards", () => ({
  WoMetricCards: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardBody", () => ({
  WoDashboardBody: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardShell", () => ({
  WoDashboardShell: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardSections", () => ({
  WoDashboardSections: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardCharts", () => ({
  WoDashboardCharts: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTables", () => ({
  WoDashboardTables: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardPanels", () => ({
  WoDashboardPanels: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardLists", () => ({
  WoDashboardLists: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardStats", () => ({
  WoDashboardStats: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardInsights", () => ({
  WoDashboardInsights: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardRealtime", () => ({
  WoDashboardRealtime: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardKPI", () => ({
  WoDashboardKPI: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardPerformance", () => ({
  WoDashboardPerformance: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrends", () => ({
  WoDashboardTrends: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardRecent", () => ({
  WoDashboardRecent: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardWorkload", () => ({
  WoDashboardWorkload: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardResponse", () => ({
  WoDashboardResponse: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardIssues", () => ({
  WoDashboardIssues: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardSites", () => ({
  WoDashboardSites: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTypes", () => ({
  WoDashboardTypes: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardDisconnections", () => ({
  WoDashboardDisconnections: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardAdminKPI", () => ({
  WoDashboardAdminKPI: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardPerformers", () => ({
  WoDashboardPerformers: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardAssists", () => ({
  WoDashboardAssists: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardLinks", () => ({
  WoDashboardLinks: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardWrapper", () => ({
  WoDashboardWrapper: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardView", () => ({
  WoDashboardView: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardContent", () => ({
  WoDashboardContent: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardGrid", () => ({
  WoDashboardGrid: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardContainer", () => ({
  WoDashboardContainer: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardLayout", () => ({
  WoDashboardLayout: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardFrame", () => ({
  WoDashboardFrame: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardOverview", () => ({
  WoDashboardOverview: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardSummary", () => ({
  WoDashboardSummary: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardCards", () => ({
  WoDashboardCards: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardMetrics", () => ({
  WoDashboardMetrics: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardRealtimeSection", () => ({
  WoDashboardRealtimeSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardRecentSection", () => ({
  WoDashboardRecentSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardStatsSection", () => ({
  WoDashboardStatsSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardChartsSection", () => ({
  WoDashboardChartsSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardInsightsSection", () => ({
  WoDashboardInsightsSection: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardPerformanceSection",
  () => ({
    WoDashboardPerformanceSection: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardKPISection", () => ({
  WoDashboardKPISection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardWorkloadSection", () => ({
  WoDashboardWorkloadSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTypeSection", () => ({
  WoDashboardTypeSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardIssueSection", () => ({
  WoDashboardIssueSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardSiteSection", () => ({
  WoDashboardSiteSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardResponseSection", () => ({
  WoDashboardResponseSection: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardDisconnectionSection",
  () => ({
    WoDashboardDisconnectionSection: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardPerformerSection", () => ({
  WoDashboardPerformerSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardAssistSection", () => ({
  WoDashboardAssistSection: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendCharts", () => ({
  WoDashboardTrendCharts: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendFilters", () => ({
  WoDashboardTrendFilters: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendBody", () => ({
  WoDashboardTrendBody: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendWrapper", () => ({
  WoDashboardTrendWrapper: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendShell", () => ({
  WoDashboardTrendShell: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendPanel", () => ({
  WoDashboardTrendPanel: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendGrid", () => ({
  WoDashboardTrendGrid: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendContainer", () => ({
  WoDashboardTrendContainer: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendContent", () => ({
  WoDashboardTrendContent: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendFrame", () => ({
  WoDashboardTrendFrame: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionView", () => ({
  WoDashboardTrendSectionView: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionBody", () => ({
  WoDashboardTrendSectionBody: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionGrid", () => ({
  WoDashboardTrendSectionGrid: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionContainer",
  () => ({
    WoDashboardTrendSectionContainer: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionShell",
  () => ({
    WoDashboardTrendSectionShell: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionFrame",
  () => ({
    WoDashboardTrendSectionFrame: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionContent",
  () => ({
    WoDashboardTrendSectionContent: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionPanel",
  () => ({
    WoDashboardTrendSectionPanel: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionWrapper",
  () => ({
    WoDashboardTrendSectionWrapper: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionMetrics",
  () => ({
    WoDashboardTrendSectionMetrics: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionCharts",
  () => ({
    WoDashboardTrendSectionCharts: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionFilters",
  () => ({
    WoDashboardTrendSectionFilters: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionMain", () => ({
  WoDashboardTrendSectionMain: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionAside",
  () => ({
    WoDashboardTrendSectionAside: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionSummary",
  () => ({
    WoDashboardTrendSectionSummary: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionHeader",
  () => ({
    WoDashboardTrendSectionHeader: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionFooter",
  () => ({
    WoDashboardTrendSectionFooter: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionLegend",
  () => ({
    WoDashboardTrendSectionLegend: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionEmpty",
  () => ({
    WoDashboardTrendSectionEmpty: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionLoading",
  () => ({
    WoDashboardTrendSectionLoading: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionCards",
  () => ({
    WoDashboardTrendSectionCards: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionStats",
  () => ({
    WoDashboardTrendSectionStats: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionRows", () => ({
  WoDashboardTrendSectionRows: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionColumns",
  () => ({
    WoDashboardTrendSectionColumns: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionBlocks",
  () => ({
    WoDashboardTrendSectionBlocks: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionList", () => ({
  WoDashboardTrendSectionList: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionItems",
  () => ({
    WoDashboardTrendSectionItems: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionTable",
  () => ({
    WoDashboardTrendSectionTable: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionWidget",
  () => ({
    WoDashboardTrendSectionWidget: vi.fn(() => null),
  }),
);

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionBox", () => ({
  WoDashboardTrendSectionBox: vi.fn(() => null),
}));

vi.mock("@/components/workorder/dashboard/WoDashboardTrendSectionTile", () => ({
  WoDashboardTrendSectionTile: vi.fn(() => null),
}));

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionStack",
  () => ({
    WoDashboardTrendSectionStack: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionShellView",
  () => ({
    WoDashboardTrendSectionShellView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionCardGrid",
  () => ({
    WoDashboardTrendSectionCardGrid: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionSplit",
  () => ({
    WoDashboardTrendSectionSplit: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionCluster",
  () => ({
    WoDashboardTrendSectionCluster: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionCanvas",
  () => ({
    WoDashboardTrendSectionCanvas: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartGrid",
  () => ({
    WoDashboardTrendSectionChartGrid: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartPanel",
  () => ({
    WoDashboardTrendSectionChartPanel: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartShell",
  () => ({
    WoDashboardTrendSectionChartShell: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBody",
  () => ({
    WoDashboardTrendSectionChartBody: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartHeader",
  () => ({
    WoDashboardTrendSectionChartHeader: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFooter",
  () => ({
    WoDashboardTrendSectionChartFooter: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartContent",
  () => ({
    WoDashboardTrendSectionChartContent: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartContainer",
  () => ({
    WoDashboardTrendSectionChartContainer: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFrame",
  () => ({
    WoDashboardTrendSectionChartFrame: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartWrapper",
  () => ({
    WoDashboardTrendSectionChartWrapper: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartView",
  () => ({
    WoDashboardTrendSectionChartView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartLayout",
  () => ({
    WoDashboardTrendSectionChartLayout: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartMetrics",
  () => ({
    WoDashboardTrendSectionChartMetrics: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartLegend",
  () => ({
    WoDashboardTrendSectionChartLegend: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFilters",
  () => ({
    WoDashboardTrendSectionChartFilters: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartSummary",
  () => ({
    WoDashboardTrendSectionChartSummary: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartStats",
  () => ({
    WoDashboardTrendSectionChartStats: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartRows",
  () => ({
    WoDashboardTrendSectionChartRows: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartColumns",
  () => ({
    WoDashboardTrendSectionChartColumns: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartCards",
  () => ({
    WoDashboardTrendSectionChartCards: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartTable",
  () => ({
    WoDashboardTrendSectionChartTable: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartList",
  () => ({
    WoDashboardTrendSectionChartList: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartItems",
  () => ({
    WoDashboardTrendSectionChartItems: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBlocks",
  () => ({
    WoDashboardTrendSectionChartBlocks: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartWidget",
  () => ({
    WoDashboardTrendSectionChartWidget: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBox",
  () => ({
    WoDashboardTrendSectionChartBox: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartTile",
  () => ({
    WoDashboardTrendSectionChartTile: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartStack",
  () => ({
    WoDashboardTrendSectionChartStack: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartSplit",
  () => ({
    WoDashboardTrendSectionChartSplit: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartCluster",
  () => ({
    WoDashboardTrendSectionChartCluster: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartCanvas",
  () => ({
    WoDashboardTrendSectionChartCanvas: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartGridView",
  () => ({
    WoDashboardTrendSectionChartGridView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartPanelView",
  () => ({
    WoDashboardTrendSectionChartPanelView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartShellView",
  () => ({
    WoDashboardTrendSectionChartShellView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBodyView",
  () => ({
    WoDashboardTrendSectionChartBodyView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartHeaderView",
  () => ({
    WoDashboardTrendSectionChartHeaderView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFooterView",
  () => ({
    WoDashboardTrendSectionChartFooterView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartContentView",
  () => ({
    WoDashboardTrendSectionChartContentView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartContainerView",
  () => ({
    WoDashboardTrendSectionChartContainerView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFrameView",
  () => ({
    WoDashboardTrendSectionChartFrameView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartWrapperView",
  () => ({
    WoDashboardTrendSectionChartWrapperView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartMetricsView",
  () => ({
    WoDashboardTrendSectionChartMetricsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartLegendView",
  () => ({
    WoDashboardTrendSectionChartLegendView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartFiltersView",
  () => ({
    WoDashboardTrendSectionChartFiltersView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartSummaryView",
  () => ({
    WoDashboardTrendSectionChartSummaryView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartStatsView",
  () => ({
    WoDashboardTrendSectionChartStatsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartRowsView",
  () => ({
    WoDashboardTrendSectionChartRowsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartColumnsView",
  () => ({
    WoDashboardTrendSectionChartColumnsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartCardsView",
  () => ({
    WoDashboardTrendSectionChartCardsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartTableView",
  () => ({
    WoDashboardTrendSectionChartTableView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartListView",
  () => ({
    WoDashboardTrendSectionChartListView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartItemsView",
  () => ({
    WoDashboardTrendSectionChartItemsView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBlocksView",
  () => ({
    WoDashboardTrendSectionChartBlocksView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartWidgetView",
  () => ({
    WoDashboardTrendSectionChartWidgetView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartBoxView",
  () => ({
    WoDashboardTrendSectionChartBoxView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartTileView",
  () => ({
    WoDashboardTrendSectionChartTileView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartStackView",
  () => ({
    WoDashboardTrendSectionChartStackView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartSplitView",
  () => ({
    WoDashboardTrendSectionChartSplitView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartClusterView",
  () => ({
    WoDashboardTrendSectionChartClusterView: vi.fn(() => null),
  }),
);

vi.mock(
  "@/components/workorder/dashboard/WoDashboardTrendSectionChartCanvasView",
  () => ({
    WoDashboardTrendSectionChartCanvasView: vi.fn(() => null),
  }),
);

vi.mock("@/lib/api-client", () => ({
  getWithAuth: mockGetWithAuth,
  deleteWithAuth: mockDeleteWithAuth,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: mockButton,
}));

vi.mock("@/components/ui/ResponsiveTable", () => ({
  ResponsiveTable: mockResponsiveTable,
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: mockModal,
  ModalFooter: mockModalFooter,
}));

vi.mock("next/link", () => ({
  default: mockLink,
}));

vi.mock("next/image", () => ({
  default: mockImage,
}));

vi.mock("next/dynamic", () => ({
  default: mockDynamic,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: mockFormatDistanceToNow,
}));

vi.mock("date-fns/locale", () => ({
  id: mockLocale,
}));

vi.mock("socket.io-client", () => {
  throw new Error(
    "socket.io-client should not be imported in realtime boundary tests",
  );
});

vi.mock("@/modules/chat", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/chat")>("@/modules/chat");

  return {
    ...actual,
    shouldNotifyForChatMessage: mockShouldNotifyForChatMessage,
  };
});

vi.mock("react-icons/fi", () => ({
  FiEdit: mockIcon,
  FiTrash2: mockIcon,
  FiEye: mockIcon,
  FiSearch: mockIcon,
  FiPaperclip: mockIcon,
  FiCamera: mockIcon,
  FiCheckCircle: mockIcon,
  FiAlertTriangle: mockIcon,
  FiXCircle: mockIcon,
  FiMinusCircle: mockIcon,
  FiFileText: mockIcon,
  FiUser: mockIcon,
}));

vi.mock("react-icons/hi2", () => ({
  HiOutlineCube: mockIcon,
  HiOutlineArchiveBox: mockIcon,
  HiOutlineBuildingOffice2: mockIcon,
  HiOutlineExclamationTriangle: mockIcon,
  HiOutlineMapPin: mockIcon,
  HiOutlineUsers: mockIcon,
  HiOutlineClock: mockIcon,
  HiOutlineArrowPath: mockIcon,
  HiMagnifyingGlass: mockIcon,
  HiOutlineSignal: mockIcon,
  HiOutlineMap: mockIcon,
  HiOutlineSquares2X2: mockIcon,
  HiOutlineChatBubbleLeftRight: mockIcon,
  HiOutlineUserGroup: mockIcon,
  HiOutlineGlobeAlt: mockIcon,
  HiOutlinePlus: mockIcon,
  HiOutlinePaperAirplane: mockIcon,
  HiOutlinePhoto: mockIcon,
  HiOutlineMagnifyingGlass: mockIcon,
  HiOutlineMegaphone: mockIcon,
}));

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: mockUseRealtime,
}));

Object.defineProperty(globalThis, "fetch", {
  value: fetchMock,
  writable: true,
});

Object.defineProperty(globalThis, "confirm", {
  value: confirmMock,
  writable: true,
});

Object.defineProperty(globalThis, "alert", {
  value: alertMock,
  writable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    location: {
      reload: reloadMock,
    },
    Notification: {
      permission: "default",
      requestPermission: vi.fn(),
    },
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  },
  writable: true,
});

beforeEach(() => {
  mockUseState.mockClear();
  mockUseEffect.mockClear();
  mockUseCallback.mockClear();
  mockUseMemo.mockClear();
  mockUseRef.mockClear();
  useRealtimeScopeMock.mockClear();
  useRealtimeEventMock.mockClear();
  mockUseDebounce.mockClear();
  mockUsePermission.mockReset();
  mockUsePermission.mockReturnValue({
    hasPermission: vi.fn(() => true),
  });
  mockUseToast.mockClear();
  mockGetWithAuth.mockClear();
  mockDeleteWithAuth.mockClear();
  mockButton.mockClear();
  mockResponsiveTable.mockClear();
  mockModal.mockClear();
  mockModalFooter.mockClear();
  mockLink.mockClear();
  mockImage.mockClear();
  mockDynamic.mockClear();
  mockIcon.mockClear();
  mockUseRealtime.mockClear();
  mockIo.mockClear();
  fetchMock.mockClear();
  confirmMock.mockClear();
  alertMock.mockClear();
  reloadMock.mockClear();
  mockShouldNotifyForChatMessage.mockClear();
  mockFormatDistanceToNow.mockClear();
});
