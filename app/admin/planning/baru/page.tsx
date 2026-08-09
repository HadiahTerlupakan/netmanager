import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningFormClient from "../PlanningFormClient";

export const dynamic = "force-dynamic";

export default async function CreatePlanningPage() {
  await ensurePermission(PERMISSIONS.PLANNING.CREATE);
  return <PlanningFormClient mode="create" />;
}
