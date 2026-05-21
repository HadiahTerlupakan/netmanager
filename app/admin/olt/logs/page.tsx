import { ensurePermission } from "@/lib/rbac";
import CommandLogsClient from "./CommandLogsClient";

export const dynamic = "force-dynamic";

export default async function CommandLogsPage() {
  await ensurePermission("olt_logs:read");
  return <CommandLogsClient />;
}
