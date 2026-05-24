import { ensureAnyPermission } from "@/lib/rbac";
import { ClientComponent } from "./SlaNewClient";

export const metadata = {
  title: "Tambah Aturan SLA",
  description: "Buat aturan SLA work order baru",
};

export default async function Page() {
  await ensureAnyPermission(["workorders:create", "wo_sla:create"]);
  return <ClientComponent />;
}
