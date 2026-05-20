import { ensurePermission } from "@/lib/rbac";
import OnuDetailClient from "./OnuDetailClient";

export const dynamic = "force-dynamic";

export default async function OnuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("olt_onu:read");
  const { id } = await params;
  return <OnuDetailClient id={id} />;
}
