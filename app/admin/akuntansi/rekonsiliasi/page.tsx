import { ensurePermission } from "@/lib/rbac";
import { RekonsiliasiListClient } from "./RekonsiliasiListClient";

export default async function RekonsiliasiPage() {
  await ensurePermission("accounting:reconciliation");
  return <RekonsiliasiListClient />;
}
