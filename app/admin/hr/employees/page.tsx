import { ensurePermission } from "@/lib/rbac";
import { HrEmployeesListClient } from "./HrEmployeesListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Pegawai - HR - Admin Portal",
};

export default async function HrEmployeesPage() {
  await ensurePermission("users:read");
  return <HrEmployeesListClient />;
}
