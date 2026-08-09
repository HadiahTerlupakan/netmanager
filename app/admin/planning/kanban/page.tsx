import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningKanbanClient from "../PlanningKanbanClient";

export const dynamic = "force-dynamic";

export default async function PlanningKanbanPage() {
  await ensurePermission(PERMISSIONS.PLANNING.READ);
  return <PlanningKanbanClient />;
}
