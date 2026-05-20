import { ensurePermission } from "@/lib/rbac";
import OltOnuListClient from "./OltOnuListClient";

export const dynamic = "force-dynamic";

export default async function OnuListPage() {
  await ensurePermission("olt_onu:read");
  return <OltOnuListClient />;
}
