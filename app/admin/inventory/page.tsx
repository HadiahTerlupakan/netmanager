import { ensureAnyPermission } from "@/lib/rbac";
import { InventoryDashboardClient } from "./InventoryIndexClient";

export default async function Page() {
  await ensureAnyPermission(["gudang:read", "barang:read", "stock:read"]);
  return <InventoryDashboardClient />;
}
