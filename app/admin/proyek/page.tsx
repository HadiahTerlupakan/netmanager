import { ensurePermission } from "@/lib/rbac";
import ProyekClient from "./ProyekClient";

export const metadata = {
  title: "Proyek (RAB)",
};

export default async function ProyekPage() {
  await ensurePermission("expense:read");
  return <ProyekClient />;
}
