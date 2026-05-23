import { ensurePermission } from "@/lib/rbac";
import { PurchaseOrderListClient } from "./PurchaseOrderListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Order - Admin Portal",
};

export default async function PurchaseOrderListPage() {
  await ensurePermission("purchase_orders:read");
  return <PurchaseOrderListClient />;
}
