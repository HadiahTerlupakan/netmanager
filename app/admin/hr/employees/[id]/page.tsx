import { ensurePermission } from "@/lib/rbac";
import { HrEmployeeDetailClient } from "./HrEmployeeDetailClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Pegawai - HR - Admin Portal",
};

export default async function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("users:read");
  return <HrEmployeeDetailClient params={params} />;
}
