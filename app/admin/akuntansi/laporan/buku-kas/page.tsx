import { ensurePermission } from "@/lib/rbac";
import { BukuKasClient } from "./BukuKasClient";

export default async function BukuKasPage() {
  await ensurePermission("accounting:read");
  return <BukuKasClient />;
}
