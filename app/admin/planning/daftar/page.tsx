import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningListClient from "../PlanningListClient";

export const dynamic = "force-dynamic";

export default async function PlanningListPage() {
  await ensurePermission(PERMISSIONS.PLANNING.READ);
  return <PlanningListClient />;
}
