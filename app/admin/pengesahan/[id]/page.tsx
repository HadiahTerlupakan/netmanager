import EndorsementDetailClient from "./EndorsementDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EndorsementDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <EndorsementDetailClient endorsementId={id} />;
}
