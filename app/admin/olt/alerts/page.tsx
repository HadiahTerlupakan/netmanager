import { ensurePermission } from "@/lib/rbac";
import AlertsClient from "./AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await ensurePermission("olt_logs:read");
  return <AlertsClient />;
}
