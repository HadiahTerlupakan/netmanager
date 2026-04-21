import { ensurePermission } from "@/lib/rbac";
import LiveMapClient from "./LiveMapClient";

export default async function LiveMapPage() {
  await ensurePermission("live_tracking:read");
  return <LiveMapClient />;
}
