import { ensurePermission } from "@/lib/rbac";
import { SiteDetailClient } from "./SiteDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteDetailPage({ params }: PageProps) {
  await ensurePermission("site:read");

  const { id } = await params;
  return <SiteDetailClient siteId={id} />;
}
