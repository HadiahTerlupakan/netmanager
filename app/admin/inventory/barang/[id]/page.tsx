import { ensurePermission } from "@/lib/rbac";
import { BarangDetailClient } from "./BarangDetailClient";

export default async function Page() {
  await ensurePermission("barang:read");
  return <BarangDetailClient />;
}
