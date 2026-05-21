import { ensurePermission } from "@/lib/rbac";
import ProfilesClient from "./ProfilesClient";

export default async function ProfilesPage() {
  await ensurePermission("salary:read");
  return <ProfilesClient />;
}
