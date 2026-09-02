import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningDetailClient from "./PlanningDetailClient";

export const dynamic = "force-dynamic";

export default async function PlanningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission(PERMISSIONS.PLANNING.READ);
  const { id } = await params;
  return <PlanningDetailClient planningId={id} />;
}
