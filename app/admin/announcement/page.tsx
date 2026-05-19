import { ensurePermission } from "@/lib/rbac";
import { AnnouncementIndexClient } from "./AnnouncementIndexClient";

export default async function Page() {
  await ensurePermission("announcement:read");
  return <AnnouncementIndexClient />;
}
