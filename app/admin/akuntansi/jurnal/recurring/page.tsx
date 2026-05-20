import { ensurePermission } from "@/lib/rbac";
import { RecurringClient } from "./RecurringClient";

export default async function RecurringPage() {
  await ensurePermission("accounting:recurring:manage");
  return <RecurringClient />;
}
