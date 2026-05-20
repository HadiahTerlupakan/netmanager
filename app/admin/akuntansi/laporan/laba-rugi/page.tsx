import { ensurePermission } from "@/lib/rbac";
import { LabaRugiClient } from "./LabaRugiClient";

export default async function LabaRugiPage() {
  await ensurePermission("accounting:read");
  return <LabaRugiClient />;
}
