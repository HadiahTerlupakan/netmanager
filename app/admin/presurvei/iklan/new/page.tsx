import { ensureAnyPermission } from "@/lib/rbac";
import { IklanCreateClient } from "./IklanCreateClient";

export const metadata = {
  title: "Kampanye Baru - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_iklan:create"]);

  return <IklanCreateClient />;
}
