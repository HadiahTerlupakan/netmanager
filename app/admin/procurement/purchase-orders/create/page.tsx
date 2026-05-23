import { ensurePermission } from "@/lib/rbac";
import { PurchaseOrderCreateClient } from "./PurchaseOrderCreateClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buat Purchase Order - Admin Portal",
};

export default async function CreatePurchaseOrderPage() {
  await ensurePermission("purchase_orders:create");
  return <PurchaseOrderCreateClient />;
}
