import LegalTemplateEditorClient from "../editor/LegalTemplateEditorClient";

export const metadata = {
  title: "Ubah Template Dokumen | NetManager",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLegalTemplatePage({ params }: PageProps) {
  const { id } = await params;

  return <LegalTemplateEditorClient templateId={id} />;
}
