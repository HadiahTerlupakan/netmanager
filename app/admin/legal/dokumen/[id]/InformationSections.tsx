import {
  formatDate,
  formatMoney,
  labelOf,
  PAYMENT_SCHEME_LABEL,
} from "../../components/legal-format";
import type { LegalDocumentDetail } from "../../components/legal-types";
import { DetailCard, DetailRows } from "./detail-primitives";

/** Seksi Informasi umum dan Atribut legal; hanya isian terisi yang tampil. */

const dateOrNull = (value: string | null) => (value ? formatDate(value) : null);

/** Nomor, pihak, masa berlaku, dan PIC. */
export function InformationSection({
  document,
}: {
  document: LegalDocumentDetail;
}) {
  return (
    <DetailCard title="Informasi">
      <DetailRows
        emptyText="Belum ada informasi tambahan."
        rows={[
          { label: "Nomor", value: document.documentNumber },
          { label: "Pihak / penerbit", value: document.partyName },
          { label: "Tanggal mulai", value: dateOrNull(document.startDate) },
          { label: "Tanggal berakhir", value: dateOrNull(document.endDate) },
          { label: "PIC", value: document.picName },
          { label: "Dicatat", value: formatDate(document.createdAt) },
        ]}
      />
    </DetailCard>
  );
}

/** Nilai kontrak dengan skema pembayarannya, mis. "Rp 1.500.000 · Bulanan". */
function describeValue(document: LegalDocumentDetail): string | null {
  if (!document.value) return null;

  const amount = formatMoney(document.value, document.currency);
  return document.paymentScheme
    ? `${amount} · ${labelOf(PAYMENT_SCHEME_LABEL, document.paymentScheme)}`
    : amount;
}

/** Jaminan beserta tanggal berakhirnya bila ada. */
function describeGuarantee(document: LegalDocumentDetail): string | null {
  const parts = [
    document.guaranteeDescription,
    document.guaranteeEndDate &&
      `berlaku sampai ${formatDate(document.guaranteeEndDate)}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

/** Perpanjangan otomatis dan masa pemberitahuan. */
function describeRenewal(document: LegalDocumentDetail): string | null {
  const notice = document.noticePeriodDays
    ? `pemberitahuan ${document.noticePeriodDays} hari sebelum berakhir`
    : null;
  if (!document.isAutoRenew) return notice;

  return notice ? `Otomatis, ${notice}` : "Otomatis";
}

/** Nilai, jaminan, perpanjangan, denda, sengketa, dan catatan. */
export function AttributeSection({
  document,
}: {
  document: LegalDocumentDetail;
}) {
  return (
    <DetailCard title="Atribut legal">
      <DetailRows
        emptyText="Belum ada atribut legal yang diisi."
        rows={[
          { label: "Nilai", value: describeValue(document) },
          { label: "Jaminan", value: describeGuarantee(document) },
          { label: "Perpanjangan", value: describeRenewal(document) },
          { label: "Denda / penalti", value: document.penaltyNotes },
          { label: "Sengketa", value: document.disputeResolution },
          { label: "Catatan", value: document.notes },
        ]}
      />
    </DetailCard>
  );
}
