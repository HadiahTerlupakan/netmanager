import type { AdminDashboardHeroViewModel } from "@/modules/admin";

interface AdminDashboardHeroProps {
  hero: AdminDashboardHeroViewModel;
}

export function AdminDashboardHero({ hero }: AdminDashboardHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-8 shadow-xl dark:from-indigo-900 dark:to-blue-900">
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Selamat Datang, {hero.viewerName}! 👋
          </h2>
          <p className="mt-2 max-w-xl text-lg text-blue-100">
            Berikut adalah overview performa sistem dan aktivitas jaringan
            terkini.
          </p>
        </div>

        <div className="hidden md:block">
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
            {hero.displayDate}
          </div>
        </div>
      </div>

      <div className="absolute right-0 top-0 -mr-10 -mt-10 h-64 w-64 rounded-full bg-white/10 dark:bg-white/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-2xl" />
    </div>
  );
}
