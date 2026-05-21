import { ensurePermission } from "@/lib/rbac";
import PayrollRunsClient from "./PayrollRunsClient";

export default async function PayrollRunsPage() {
  await ensurePermission("salary:read");
  return <PayrollRunsClient />;
}
