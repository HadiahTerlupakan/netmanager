import TemplateDocumentClient from "./TemplateDocumentClient";

export const metadata = {
  title: "Buat Dokumen dari Template | NetManager",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UseLegalTemplatePage({ params }: PageProps) {
  const { id } = await params;

  return <TemplateDocumentClient templateId={id} />;
}
