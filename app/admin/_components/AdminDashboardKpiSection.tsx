import type { AdminDashboardKpiCards } from "@/modules/admin";

type AdminDashboardKpiSectionProps = {
  section: {
    state: "ready" | "error";
    data: AdminDashboardKpiCards | null;
    message?: string;
  };
};

export function AdminDashboardKpiSection({
  section,
}: AdminDashboardKpiSectionProps) {
  const hasValidData = section.state === "ready" && section.data !== null;

  return (
    <section>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {hasValidData ? (
          <>
            <KpiCard
              title="Kehadiran"
              value={section.data.systemSummary.attendance.present}
              description="Hadir hari ini"
              accent="blue"
            />
            <KpiCard
              title="Work Order Pending"
              value={section.data.systemSummary.workOrder.pending}
              description="Pekerjaan menunggu"
              accent="indigo"
            />
            <KpiCard
              title="Marketing Pending"
              value={section.data.systemSummary.marketing.pendingClaims}
              description="Claim belum disetujui"
              accent="green"
            />
            <KpiCard
              title="Inventaris"
              value={section.data.systemSummary.inventory.totalItems}
              description="Total item tercatat"
              accent="red"
            />
          </>
        ) : (
          <div className="xl:col-span-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {section.message ??
              "Data KPI admin dashboard tidak valid atau gagal dimuat"}
          </div>
        )}
      </div>
    </section>
  );
}

type KpiCardProps = {
  title: string;
  value: number;
  description: string;
  accent: "blue" | "indigo" | "green" | "red";
};

function KpiCard({ title, value, description, accent }: KpiCardProps) {
  const accentStyles = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-surface p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <h3 className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {value}
          </h3>
          <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${accentStyles[accent]}`} />
      </div>
    </div>
  );
}
