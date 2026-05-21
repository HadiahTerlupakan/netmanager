import { ensurePermission } from "@/lib/rbac";
import { DashboardPajakClient } from "./DashboardPajakClient";

export default async function DashboardPajakPage() {
  await ensurePermission("tax:read");
  return <DashboardPajakClient />;
}
