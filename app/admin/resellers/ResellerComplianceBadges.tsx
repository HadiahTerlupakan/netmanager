import { Badge } from "@/components/ui/badge";
import type { PksStatus, Reseller } from "./types";
import { PKS_STATUS_LABELS, RESELLER_STATUS_LABELS } from "./types";

const PKS_BADGE_VARIANTS: Record<PksStatus, "success" | "warning" | "error"> = {
  ACTIVE: "success",
  EXPIRING: "warning",
  PENDING: "warning",
  EXPIRED: "error",
  NONE: "error",
};

const PKS_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function formatPksDate(isoDate: string): string {
  return PKS_DATE_FORMAT.format(new Date(isoDate));
}

/** Label status PKS, plus sisa hari bila segera berakhir atau tanggal mulai bila belum berlaku. */
export function formatPksLabel(reseller: Reseller): string {
  const pks = reseller.compliance?.pks;
  if (!pks) return "-";
  if (pks.status === "EXPIRING" && pks.daysLeft !== null) {
    return `${PKS_STATUS_LABELS.EXPIRING} (${pks.daysLeft} hari lagi)`;
  }
  if (pks.status === "PENDING" && pks.startDate) {
    return `${PKS_STATUS_LABELS.PENDING} (mulai ${formatPksDate(pks.startDate)})`;
  }
  return PKS_STATUS_LABELS[pks.status];
}

/** Badge status PKS reseller (aktif / segera berakhir / belum berlaku / kedaluwarsa / belum ada). */
export function PksStatusBadge({ reseller }: { readonly reseller: Reseller }) {
  const pks = reseller.compliance?.pks;
  if (!pks) return <span>-</span>;
  return (
    <Badge variant={PKS_BADGE_VARIANTS[pks.status]}>
      {formatPksLabel(reseller)}
    </Badge>
  );
}

/** Status kemitraan beserta peringatan bila reseller belum patuh. */
export function PartnershipStatusCell({
  reseller,
}: {
  readonly reseller: Reseller;
}) {
  const isNonCompliant = reseller.compliance?.isCompliant === false;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={reseller.status === "ACTIVE" ? "success" : "default"}>
        {RESELLER_STATUS_LABELS[reseller.status]}
      </Badge>
      {isNonCompliant && (
        <Badge variant="warning">
          <span title={reseller.compliance?.issueLabels.join("; ")}>
            Belum patuh
          </span>
        </Badge>
      )}
    </span>
  );
}
