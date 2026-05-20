import { ensurePermission } from "@/lib/rbac";
import { NeracaClient } from "./NeracaClient";

export default async function NeracaPage() {
  await ensurePermission("accounting:read");
  return <NeracaClient />;
}
