import {
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
} from "../components/legal-types";
import LegalDocumentListClient from "./LegalDocumentListClient";

export const metadata = {
  title: "Dokumen Legal | NetManager",
};

interface PageProps {
  searchParams: Promise<{ status?: string; documentType?: string }>;
}

/** Nilai query yang dikenal saja yang diteruskan; selain itu filter kosong. */
function pickKnown(value: string | undefined, known: readonly string[]): string {
  return value && known.includes(value) ? value : "";
}

export default async function LegalDocumentListPage({ searchParams }: PageProps) {
  const { status, documentType } = await searchParams;

  return (
    <LegalDocumentListClient
      initialStatus={pickKnown(status, LEGAL_DOCUMENT_STATUSES)}
      initialDocumentType={pickKnown(documentType, LEGAL_DOCUMENT_TYPES)}
    />
  );
}
