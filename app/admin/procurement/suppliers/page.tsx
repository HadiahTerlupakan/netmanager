import { ensurePermission } from "@/lib/rbac";
import { SupplierListClient } from "./SupplierListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Master Supplier - Admin Portal",
};

export default async function SuppliersPage() {
  await ensurePermission("supplier:read");
  return <SupplierListClient />;
}
