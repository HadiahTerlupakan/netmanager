import { ensurePermission } from "@/lib/rbac";
import DepositsClient from "./DepositsClient";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  await ensurePermission("investors:manage");
  return <DepositsClient />;
}
