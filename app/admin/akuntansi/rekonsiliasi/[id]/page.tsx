import { ensurePermission } from "@/lib/rbac";
import { RekonsiliasiDetailClient } from "./RekonsiliasiDetailClient";

export default async function RekonsiliasiDetailPage() {
  await ensurePermission("accounting:reconciliation");
  return <RekonsiliasiDetailClient />;
}
