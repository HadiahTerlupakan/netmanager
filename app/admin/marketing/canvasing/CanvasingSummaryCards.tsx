import type { CanvasingSummary } from "./CanvasingListTypes";

interface SummaryCardProps {
  label: string;
  value: number;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

interface CanvasingSummaryCardsProps {
  summary: CanvasingSummary;
}

/** Render KPI cards for canvasing list summary. */
export default function CanvasingSummaryCards({
  summary,
}: CanvasingSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <SummaryCard label="Total" value={summary.total} />
      <SummaryCard label="Pending" value={summary.pending} />
      <SummaryCard label="Approved" value={summary.approved} />
      <SummaryCard label="Rejected" value={summary.rejected} />
      <SummaryCard label="Pending Claim" value={summary.pendingClaims} />
    </div>
  );
}
