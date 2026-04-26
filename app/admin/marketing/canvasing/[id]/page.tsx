import { ensureAnyPermission } from "@/lib/rbac";
import CanvasingDetailClient from "@/app/admin/marketing/canvasing/[id]/CanvasingDetailClient";

export default async function CanvasingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureAnyPermission(["canvasing:read", "canvasing:verify"]);
  const { id } = await params;
  return <CanvasingDetailClient id={id} />;
}
