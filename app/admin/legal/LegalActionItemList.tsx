import Link from "next/link";
import { DeadlineKindBadge, DeadlineTiming } from "./components/LegalBadges";
import { formatDate } from "./components/legal-format";
import type { LegalActionItem } from "./components/legal-types";

/** Daftar "Perlu tindakan" — tenggat paling mendesak lebih dulu. */
export default function LegalActionItemList({
  items,
}: {
  items: LegalActionItem[];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        Perlu tindakan
      </h2>
      {items.length === 0 ? (
        <p className="p-6 text-sm text-gray-600 dark:text-gray-300">
          Tidak ada tenggat yang perlu ditindaklanjuti. Semua aman.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={`${item.documentId}-${item.kind}-${item.date}`}
              className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700/60"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/legal/dokumen/${item.documentId}`}
                  className="font-medium text-gray-900 hover:underline dark:text-white"
                >
                  {item.documentTitle}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <DeadlineKindBadge kind={item.kind} />
                  <span>{item.label}</span>
                  {item.categoryName && <span>{item.categoryName}</span>}
                  <span>PIC: {item.picName ?? "—"}</span>
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-gray-700 dark:text-gray-300">
                  {formatDate(item.date)}
                </p>
                <DeadlineTiming daysLeft={item.daysLeft} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
