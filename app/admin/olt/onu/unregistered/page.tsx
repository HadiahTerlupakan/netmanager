import { ensurePermission } from "@/lib/rbac";
import UnregisteredOnuClient from "./UnregisteredOnuClient";

export const dynamic = "force-dynamic";

export default async function UnregisteredOnuPage() {
  await ensurePermission("olt_onu:read");
  return <UnregisteredOnuClient />;
}
