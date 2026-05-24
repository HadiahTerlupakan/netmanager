import { ensureAnyPermission } from "@/lib/rbac";
import { ClientComponent } from "./SlaEditClient";

export const metadata = {
  title: "Edit Aturan SLA",
  description: "Ubah aturan SLA work order",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureAnyPermission(["workorders:update", "wo_sla:update"]);
  return <ClientComponent params={params} />;
}
