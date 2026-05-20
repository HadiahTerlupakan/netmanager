import { ensurePermission } from "@/lib/rbac";
import { JurnalListClient } from "./JurnalListClient";

export default async function JurnalPage() {
  await ensurePermission("accounting:read");
  return <JurnalListClient />;
}
