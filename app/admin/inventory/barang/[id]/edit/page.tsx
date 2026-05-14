import { ensurePermission } from "@/lib/rbac";
import { BarangEditClient } from "./BarangEditClient";

export default async function Page() {
  await ensurePermission("barang:update");
  return <BarangEditClient />;
}
