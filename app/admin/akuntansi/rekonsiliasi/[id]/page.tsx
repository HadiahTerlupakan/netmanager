import { ensurePermission } from "@/lib/rbac";
import { RekonsiliasiDetailClient } from "./RekonsiliasiDetailClient";

export default async function RekonsiliasiDetailPage() {
  await ensurePermission("reconciliation:read");
  return <RekonsiliasiDetailClient />;
}
