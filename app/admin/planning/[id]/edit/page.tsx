import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningEditClient from "./PlanningEditClient";

export const dynamic = "force-dynamic";

export default async function EditPlanningPage({
  params,
}: {
  params: { id: string };
}) {
  await ensurePermission(PERMISSIONS.PLANNING.UPDATE);
  return <PlanningEditClient planningId={params.id} />;
}
