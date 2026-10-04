import Link from "next/link";
import { formatDate } from "../../components/legal-format";
import type { LegalDocumentDetail } from "../../components/legal-types";
import { DetailCard, DetailRows, type DetailRow } from "./detail-primitives";

/** Riwayat dokumen: rantai perpanjangan, asal pengesahan, dan pengakhiran. */

const LINK_CLASS = "text-indigo-600 hover:underline dark:text-indigo-400";

function buildHistoryRows(document: LegalDocumentDetail): DetailRow[] {
  return [
    {
      label: "Dokumen sebelumnya",
      value: document.previousDocumentId && (
        <Link href={`/admin/legal/dokumen/${document.previousDocumentId}`} className={LINK_CLASS}>
          Lihat dokumen sebelumnya
        </Link>
      ),
    },
    {
      label: "Diperpanjang menjadi",
      value: document.renewedById && (
        <Link href={`/admin/legal/dokumen/${document.renewedById}`} className={LINK_CLASS}>
          Lihat dokumen perpanjangan
        </Link>
      ),
    },
    {
      label: "Surat pengesahan",
      value: document.endorsementId && (
        <Link href={`/admin/pengesahan/${document.endorsementId}`} className={LINK_CLASS}>
          Lihat surat pengesahan
        </Link>
      ),
    },
    {
      label: "Diakhiri",
      value: document.terminatedAt && formatDate(document.terminatedAt),
    },
    { label: "Alasan pengakhiran", value: document.terminationReason },
  ];
}

export default function HistorySection({
  document,
}: {
  document: LegalDocumentDetail;
}) {
  return (
    <DetailCard title="Riwayat">
      <DetailRows
        rows={buildHistoryRows(document)}
        emptyText="Dokumen asli, belum pernah diperpanjang atau diakhiri."
      />
    </DetailCard>
  );
}
