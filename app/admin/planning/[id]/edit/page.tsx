import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningEditClient from "./PlanningEditClient";

export const dynamic = "force-dynamic";

export default async function EditPlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission(PERMISSIONS.PLANNING.UPDATE);
  const { id } = await params;
  return <PlanningEditClient planningId={id} />;
}
