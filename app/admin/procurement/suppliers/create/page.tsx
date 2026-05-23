import { ensurePermission } from "@/lib/rbac";
import { SupplierCreateClient } from "./SupplierCreateClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tambah Supplier - Admin Portal",
};

export default async function SupplierCreatePage() {
  await ensurePermission("supplier:create");
  return <SupplierCreateClient />;
}
