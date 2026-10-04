import Link from "next/link";
import {
  ConfidentialBadge,
  DeadlineTiming,
  LegalStatusBadge,
} from "../components/LegalBadges";
import {
  DOCUMENT_TYPE_LABEL,
  formatDate,
  formatValidity,
  labelOf,
} from "../components/legal-format";
import type { LegalDocumentListItem } from "../components/legal-types";

/** Tabel dokumen legal: judul, jenis/kategori, status, berakhir, tenggat terdekat. */
export default function LegalDocumentTable({
  items,
}: {
  items: LegalDocumentListItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Belum ada dokumen yang cocok.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3">Judul</th>
            <th className="px-4 py-3">Jenis / kategori</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Berakhir</th>
            <th className="px-4 py-3">Tenggat terdekat</th>
            <th className="px-4 py-3">PIC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gray-100 last:border-0 dark:border-gray-700/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/legal/dokumen/${item.id}`}
                  className="font-medium text-gray-900 hover:underline dark:text-white"
                >
                  {item.title}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[item.documentNumber, item.partyName].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                <p>{labelOf(DOCUMENT_TYPE_LABEL, item.documentType)}</p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {item.categoryName ?? "—"}
                  {item.isConfidential && <ConfidentialBadge />}
                </p>
              </td>
              <td className="px-4 py-3">
                <LegalStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {formatValidity(item.endDate)}
              </td>
              <td className="px-4 py-3">
                {item.nextDeadline ? (
                  <>
                    <p className="text-gray-700 dark:text-gray-300">
                      {item.nextDeadline.label}
                    </p>
                    <p className="text-xs">
                      {formatDate(item.nextDeadline.date)} ·{" "}
                      <DeadlineTiming daysLeft={item.nextDeadline.daysLeft} />
                    </p>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {item.picName ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
