import DashboardSiteTable from "@/components/dashboard/DashboardSiteTable";
import type { AdminDashboardLeaderboards } from "@/modules/admin";

type AdminDashboardLeaderboardSectionProps = {
  section: {
    state: "ready" | "error";
    data: AdminDashboardLeaderboards | null;
    message?: string;
  };
};

export function AdminDashboardLeaderboardSection({
  section,
}: AdminDashboardLeaderboardSectionProps) {
  if (section.state === "error" || section.data === null) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        {section.message ??
          "Data leaderboard admin dashboard tidak valid atau gagal dimuat"}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="xl:col-span-1 rounded-2xl border border-gray-200 bg-surface shadow-sm dark:border-gray-700 dark:bg-surface">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white p-5 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-800/20">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            Top 5 Karyawan
          </h3>
        </div>
        <div className="p-2">
          {section.data.topEmployees.map((employee, index) => (
            <div
              key={employee.userId}
              className="mb-2 flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
            >
              <div className="flex items-center gap-4 pl-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-sm font-bold text-slate-500 dark:bg-gray-800/50 dark:text-slate-400">
                  {index + 1}
                </div>
                <div>
                  <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {employee.name}
                  </p>
                  <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                    {employee.site || "General"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                  {employee.metrics.totalScore} pts
                </span>
              </div>
            </div>
          ))}
          {section.data.topEmployees.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              Belum ada data karyawan
            </div>
          )}
        </div>
      </div>

      <div className="xl:col-span-2 space-y-6">
        <LeaderboardTableCard
          title="Site Bermasalah (Troubled)"
          description="Berdasarkan jumlah tiket gangguan"
          color="red"
          data={section.data.topProblematicSites}
          emptyMessage="Aman! Tidak ada site bermasalah signifikan."
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <LeaderboardTableCard
            title="Pemasangan Baru"
            description=""
            color="green"
            data={section.data.topInstallationSites}
            emptyMessage="Belum ada instalasi baru"
          />
          <LeaderboardTableCard
            title="Site Dismantle"
            description=""
            color="orange"
            data={section.data.topDismantleSites}
            emptyMessage="Belum ada pemutusan"
          />
        </div>
      </div>
    </section>
  );
}

type LeaderboardTableCardProps = {
  title: string;
  description: string;
  color: "red" | "orange" | "green";
  data: Array<{ siteId: string; siteName: string; count: number }>;
  emptyMessage: string;
};

function LeaderboardTableCard({
  title,
  description,
  color,
  data,
  emptyMessage,
}: LeaderboardTableCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-sm dark:border-gray-700 dark:bg-surface">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {description ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-1">
        <DashboardSiteTable
          data={data}
          color={color}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
