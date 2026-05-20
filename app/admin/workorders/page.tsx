import { ensureAnyPermission } from "@/lib/rbac";
import { ClientComponent } from "./WoIndexClient";

export default async function Page() {
  await ensureAnyPermission([
    "workorders:read",
    "work_order_dashboard:read",
    "site:read",
    "department:read",
  ]);
  return <ClientComponent />;
}
