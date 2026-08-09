import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningDashboardClient from "./PlanningDashboardClient";

export const dynamic = "force-dynamic";

export default async function PlanningDashboardPage() {
  await ensurePermission(PERMISSIONS.PLANNING.READ);
  return <PlanningDashboardClient />;
}
