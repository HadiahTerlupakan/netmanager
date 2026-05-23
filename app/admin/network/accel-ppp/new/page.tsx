import { ensurePermission } from "@/lib/rbac";
import AccelPppServerForm from "../AccelPppServerForm";

export const dynamic = "force-dynamic";

export default async function NewAccelPppPage() {
  await ensurePermission("accel_ppp:create");
  return <AccelPppServerForm mode="create" />;
}
