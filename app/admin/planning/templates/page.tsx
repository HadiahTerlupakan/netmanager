import { ensurePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import PlanningTemplatesClient from "../PlanningTemplatesClient";

export const dynamic = "force-dynamic";

export default async function PlanningTemplatesPage() {
  await ensurePermission(PERMISSIONS.PLANNING.READ);
  return <PlanningTemplatesClient />;
}
