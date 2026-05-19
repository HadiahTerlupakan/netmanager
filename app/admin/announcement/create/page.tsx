import { ensurePermission } from "@/lib/rbac";
import { AnnouncementCreateClient } from "./AnnouncementCreateClient";

export default async function Page() {
  await ensurePermission("announcement:create");
  return <AnnouncementCreateClient />;
}
