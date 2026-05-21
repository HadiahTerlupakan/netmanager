import { ensurePermission } from "@/lib/rbac";
import MonitoringDashboardClient from "./MonitoringDashboardClient";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  await ensurePermission("olt:read");
  return <MonitoringDashboardClient />;
}
