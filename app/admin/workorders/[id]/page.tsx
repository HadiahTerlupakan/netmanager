import { ensurePermission } from "@/lib/rbac";
import { ClientComponent } from "./WoDetailClient";

export default async function Page() {
  await ensurePermission("workorders:read");
  return <ClientComponent />;
}
