import { ensurePermission } from "@/lib/rbac";
import { BukuBesarClient } from "./BukuBesarClient";

export default async function BukuBesarPage() {
  await ensurePermission("accounting:read");
  return <BukuBesarClient />;
}
