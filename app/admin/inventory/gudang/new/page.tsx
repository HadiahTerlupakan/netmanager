import { ensurePermission } from "@/lib/rbac";
import { GudangNewClient } from "./GudangNewClient";

export default async function Page() {
  await ensurePermission("gudang:create");
  return <GudangNewClient />;
}
