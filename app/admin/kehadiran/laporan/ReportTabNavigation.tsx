import { Button } from "@/components/ui/Button";

export type ReportTab = "dashboard" | "rekap";

interface ReportTabNavigationProps {
  readonly activeTab: ReportTab;
  readonly onTabChange: (tab: ReportTab) => void;
}

const getTabClassName = (isActive: boolean): string =>
  `px-4 py-2 font-medium text-sm transition-colors rounded-none border-b-2 ${
    isActive
      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-transparent hover:bg-transparent"
      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
  }`;

/** Renders dashboard and employee recap tab controls. */
export function ReportTabNavigation({
  activeTab,
  onTabChange,
}: ReportTabNavigationProps) {
  return (
    <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
      <Button
        variant="ghost"
        onClick={() => onTabChange("dashboard")}
        className={getTabClassName(activeTab === "dashboard")}
      >
        📊 Dashboard
      </Button>
      <Button
        variant="ghost"
        onClick={() => onTabChange("rekap")}
        className={getTabClassName(activeTab === "rekap")}
      >
        👥 Rekap Karyawan
      </Button>
    </div>
  );
}
