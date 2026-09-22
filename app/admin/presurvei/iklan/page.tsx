import { ensureAnyPermission } from "@/lib/rbac";
import { IklanClient } from "./IklanClient";

export const metadata = {
  title: "Kampanye Iklan - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_iklan:read"]);

  return <IklanClient />;
}
