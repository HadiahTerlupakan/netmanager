import type { AdminDashboardOverviewCards } from "@/modules/admin";

type AdminDashboardOverviewSectionProps = {
  section: {
    state: "ready" | "error";
    data: AdminDashboardOverviewCards | null;
    message?: string;
  };
};

export function AdminDashboardOverviewSection({
  section,
}: AdminDashboardOverviewSectionProps) {
  const hasValidData = section.state === "ready" && section.data !== null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Router & Sesi
        </h3>
        <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 dark:border-gray-700 dark:bg-gray-800/50">
          Live router data
        </span>
      </div>

      {hasValidData ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewCard
            title="Total Router"
            accent="blue"
            valueLabel="Jumlah perangkat terdaftar"
            value={section.data.routerStats.total}
          />
          <OverviewCard
            title="Router Online"
            accent="purple"
            valueLabel="Perangkat aktif"
            value={section.data.routerStats.online}
          />
          <OverviewCard
            title="Router Offline"
            accent="pink"
            valueLabel="Perangkat tidak aktif"
            value={section.data.routerStats.offline}
          />
          <OverviewCard
            title="User Online"
            accent="emerald"
            valueLabel="Sesi aktif saat ini"
            value={section.data.routerStats.totalUserOnline}
            compact
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {section.message ??
            "Data overview admin dashboard tidak valid atau gagal dimuat"}
        </div>
      )}
    </section>
  );
}

type OverviewCardProps = {
  title: string;
  accent: "blue" | "purple" | "pink" | "emerald";
  valueLabel: string;
  value: number;
  compact?: boolean;
};

function OverviewCard({
  title,
  accent,
  valueLabel,
  value,
  compact,
}: OverviewCardProps) {
  const accentClasses = {
    blue: "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400",
    purple:
      "border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400",
    pink: "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400",
    emerald:
      "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-surface p-5 shadow-sm dark:border-gray-700 dark:bg-surface">
      <div
        className={`absolute right-0 top-0 p-4 opacity-5 ${accentClasses[accent]}`}
      />
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`rounded-lg border bg-opacity-10 p-2 ${accentClasses[accent]}`}
        />
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h4>
      </div>
      <div
        className={compact ? "flex h-20 flex-col justify-center" : "space-y-2"}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">{valueLabel}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </p>
      </div>
    </div>
  );
}
