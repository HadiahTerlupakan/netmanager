import { ensurePermission } from "@/lib/rbac";
import OltDeviceListClient from "./OltDeviceListClient";

export const dynamic = "force-dynamic";

export default async function OltDevicesPage() {
  await ensurePermission("olt:read");
  return <OltDeviceListClient />;
}
