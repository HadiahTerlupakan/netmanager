import { ensurePermission } from "@/lib/rbac";
import { IncidentsListClient } from "./IncidentsListClient";

export const metadata = {
  title: "Manajemen Insiden",
  description: "Kelola gangguan layanan yang tampil di halaman status publik",
};

export default async function Page() {
  await ensurePermission("incidents:read");
  return <IncidentsListClient />;
}
