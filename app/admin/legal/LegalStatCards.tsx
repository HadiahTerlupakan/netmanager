import Link from "next/link";
import type { LegalDashboard } from "./components/legal-types";

/** Tiga kartu angka dasbor; kartu berstatus menautkan ke daftar terfilter. */

interface StatCard {
  label: string;
  count: number;
  tone: string;
  href?: string;
}

function buildStatCards(dashboard: LegalDashboard): StatCard[] {
  return [
    {
      label: "Segera berakhir (≤ 90 hari)",
      count: dashboard.soonCount,
      tone: "text-amber-600 dark:text-amber-400",
      href: "/admin/legal/dokumen?status=SEGERA_BERAKHIR",
    },
    {
      label: "Kedaluwarsa",
      count: dashboard.expiredCount,
      tone: "text-red-600 dark:text-red-400",
      href: "/admin/legal/dokumen?status=KEDALUWARSA",
    },
    {
      label: "Jatuh tempo minggu ini",
      count: dashboard.dueThisWeekCount,
      tone: "text-indigo-600 dark:text-indigo-400",
    },
  ];
}

const CARD_CLASS =
  "block rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";

export default function LegalStatCards({
  dashboard,
}: {
  dashboard: LegalDashboard;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {buildStatCards(dashboard).map((card) => {
        const content = (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className={`text-2xl font-semibold ${card.tone}`}>{card.count}</p>
          </>
        );

        return card.href ? (
          <Link
            key={card.label}
            href={card.href}
            className={`${CARD_CLASS} hover:border-indigo-300 dark:hover:border-indigo-600`}
          >
            {content}
          </Link>
        ) : (
          <div key={card.label} className={CARD_CLASS}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
