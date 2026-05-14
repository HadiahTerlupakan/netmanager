import { ensurePermission } from "@/lib/rbac";
import { BarangNewClient } from "./BarangNewClient";

export default async function Page() {
  await ensurePermission("barang:create");
  return <BarangNewClient />;
}
