import LegalDocumentDetailClient from "./LegalDocumentDetailClient";

export const metadata = {
  title: "Detail Dokumen Legal | NetManager",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegalDocumentDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <LegalDocumentDetailClient documentId={id} />;
}
