import { ensurePermission } from "@/lib/rbac";
import AccelPppServerList from "./AccelPppServerList";

export const dynamic = "force-dynamic";

export default async function AccelPppPage() {
  await ensurePermission("accel_ppp:read");
  return <AccelPppServerList />;
}
