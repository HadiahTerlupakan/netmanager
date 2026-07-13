import { ensurePermission } from "@/lib/rbac";
import JasaList from "./JasaList";

export const dynamic = "force-dynamic";

export default async function JasaPage() {
  await ensurePermission("barang:read");

  return <JasaList />;
}
