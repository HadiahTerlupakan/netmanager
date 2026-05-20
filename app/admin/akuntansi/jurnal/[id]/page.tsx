import { ensurePermission } from "@/lib/rbac";
import { JurnalDetailClient } from "./JurnalDetailClient";

export default async function JurnalDetailPage() {
  await ensurePermission("accounting:read");
  return <JurnalDetailClient />;
}
