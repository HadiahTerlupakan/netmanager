import { ensurePermission } from "@/lib/rbac";
import { ActivityLogClient } from "./ActivityLogClient";

export default async function ActivityLogPage() {
  await ensurePermission("system_log:read");
  return <ActivityLogClient />;
}
