import { ensurePermission } from "@/lib/rbac";
import { PayrollConfigClient } from "./PayrollConfigClient";

export default async function PayrollConfigPage() {
  await ensurePermission("salary:read");
  return <PayrollConfigClient />;
}
