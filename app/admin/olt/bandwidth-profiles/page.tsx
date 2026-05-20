import { ensurePermission } from "@/lib/rbac";
import BandwidthProfileClient from "./BandwidthProfileClient";

export const dynamic = "force-dynamic";

export default async function BandwidthProfilesPage() {
  await ensurePermission("olt:read");
  return <BandwidthProfileClient />;
}
