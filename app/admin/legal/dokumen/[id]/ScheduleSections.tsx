import {
  DeadlineKindBadge,
  DeadlineTiming,
} from "../../components/LegalBadges";
import {
  formatDate,
  labelOf,
  RECURRENCE_LABEL,
} from "../../components/legal-format";
import type {
  LegalDeadline,
  LegalObligation,
} from "../../components/legal-types";
import { DetailCard } from "./detail-primitives";

/** Seksi Tenggat dan Kewajiban berkala pada detail dokumen. */

const LIST_ITEM_CLASS =
  "flex items-start justify-between gap-3 border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-700/60";

/** Semua tenggat yang dipantau beserta waktu relatifnya. */
export function DeadlineSection({ deadlines }: { deadlines: LegalDeadline[] }) {
  return (
    <DetailCard title="Tenggat">
      {deadlines.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tidak ada tenggat yang dipantau.
        </p>
      ) : (
        <ul>
          {deadlines.map((deadline) => (
            <li key={`${deadline.kind}-${deadline.date}-${deadline.label}`} className={LIST_ITEM_CLASS}>
              <div className="space-y-1">
                <DeadlineKindBadge kind={deadline.kind} />
                <p className="text-gray-900 dark:text-white">{deadline.label}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-gray-700 dark:text-gray-300">
                  {formatDate(deadline.date)}
                </p>
                <DeadlineTiming daysLeft={deadline.daysLeft} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

/** Kewajiban berkala dengan jatuh tempo berikutnya. */
export function ObligationSection({
  obligations,
}: {
  obligations: LegalObligation[];
}) {
  return (
    <DetailCard title="Kewajiban">
      {obligations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tidak ada kewajiban berkala.
        </p>
      ) : (
        <ul>
          {obligations.map((obligation) => (
            <li key={obligation.id} className={LIST_ITEM_CLASS}>
              <div>
                <p className="text-gray-900 dark:text-white">
                  {obligation.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {labelOf(RECURRENCE_LABEL, obligation.recurrence)}
                </p>
              </div>
              <p className="shrink-0 text-right text-gray-700 dark:text-gray-300">
                Berikutnya {formatDate(obligation.nextDueDate)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}
