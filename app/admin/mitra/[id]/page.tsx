import { ensurePermission } from "@/lib/rbac";
import MitraDetailClient from "./MitraDetailClient";

export const dynamic = "force-dynamic";

export default async function MitraDetailPage() {
  await ensurePermission("mitra:read");
  return <MitraDetailClient />;
}
