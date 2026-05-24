import { ensurePermission } from "@/lib/rbac";
import { ARAgingClient } from "./ARAgingClient";

export const metadata = {
  title: "AR Aging Report",
  description: "Laporan aging piutang pelanggan",
};

export default async function Page() {
  await ensurePermission("finance:read");
  return <ARAgingClient />;
}
