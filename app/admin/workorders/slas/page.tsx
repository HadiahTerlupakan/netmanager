import { ensureAnyPermission } from "@/lib/rbac";
import { ClientComponent } from "./SlasIndexClient";

export const metadata = {
  title: "Aturan SLA Work Order",
  description: "Kelola target response & resolution time work order",
};

export default async function Page() {
  await ensureAnyPermission(["workorders:read", "wo_sla:read"]);
  return <ClientComponent />;
}
