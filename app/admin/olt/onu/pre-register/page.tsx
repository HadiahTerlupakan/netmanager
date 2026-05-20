import { ensurePermission } from "@/lib/rbac";
import PreRegisterClient from "./PreRegisterClient";

export const dynamic = "force-dynamic";

export default async function PreRegisterPage() {
  await ensurePermission("olt_onu:create");
  return <PreRegisterClient />;
}
