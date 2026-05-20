import { ensurePermission } from "@/lib/rbac";
import { ArusKasClient } from "./ArusKasClient";

export default async function ArusKasPage() {
  await ensurePermission("accounting:read");
  return <ArusKasClient />;
}
