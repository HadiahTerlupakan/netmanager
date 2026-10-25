import { ensurePermission } from "@/lib/rbac";
import { ClientComponent } from "./HalamanIsolirClient";

export default async function HalamanIsolirPage() {
  await ensurePermission("isolir_page:read");
  return <ClientComponent />;
}
