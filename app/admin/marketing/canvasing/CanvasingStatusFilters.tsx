import type {
  CanvasingStatusFilter,
  CanvasingSummary,
} from "./CanvasingListTypes";

interface StatusFilterButtonProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function StatusFilterButton({
  label,
  count,
  isActive,
  onClick,
  disabled = false,
}: StatusFilterButtonProps) {
  const activeClass =
    "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-200";
  const idleClass =
    "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300 dark:disabled:hover:border-gray-700 dark:disabled:hover:text-gray-300";
  const badgeClass = isActive
    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-800/60 dark:text-indigo-100"
    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={`inline-flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${isActive ? activeClass : idleClass}`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
      >
        {count}
      </span>
    </button>
  );
}

interface CanvasingStatusFiltersProps {
  summary: CanvasingSummary;
  statusFilter: CanvasingStatusFilter;
  onChange: (value: CanvasingStatusFilter) => void;
}

/** Render quick server-side status filters with accessible pressed state. */
export default function CanvasingStatusFilters({
  summary,
  statusFilter,
  onChange,
}: CanvasingStatusFiltersProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Filter Status
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Klik status untuk memfilter data dari server.
          </p>
        </div>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
          role="group"
          aria-label="Filter status canvasing"
        >
          <StatusFilterButton
            label="Semua"
            count={summary.total}
            isActive={statusFilter === "ALL"}
            onClick={() => onChange("ALL")}
          />
          <StatusFilterButton
            label="Pending"
            count={summary.pending}
            isActive={statusFilter === "PENDING"}
            onClick={() => onChange("PENDING")}
          />
          <StatusFilterButton
            label="Approved"
            count={summary.approved}
            isActive={statusFilter === "APPROVED"}
            onClick={() => onChange("APPROVED")}
          />
          <StatusFilterButton
            label="Rejected"
            count={summary.rejected}
            isActive={statusFilter === "REJECTED"}
            onClick={() => onChange("REJECTED")}
          />
          <StatusFilterButton
            label="Pending Claim"
            count={summary.pendingClaims}
            isActive={false}
            onClick={() => undefined}
            disabled
          />
        </div>
      </div>
    </div>
  );
}
