import { ensurePermission } from "@/lib/rbac";
import OltDeviceFormClient from "./OltDeviceFormClient";

export const dynamic = "force-dynamic";

export default async function TambahOltPage() {
  await ensurePermission("olt_devices:create");
  return <OltDeviceFormClient />;
}
