import { ensurePermission } from "@/lib/rbac";
import { LaporanIndexClient } from "./LaporanIndexClient";

export default async function LaporanPage() {
  await ensurePermission("accounting:read");
  return <LaporanIndexClient />;
}
