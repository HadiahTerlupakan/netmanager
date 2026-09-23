import { ensureAnyPermission } from "@/lib/rbac";
import { TargetClient } from "./TargetClient";

export const metadata = {
  title: "Target Sales - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_target:read"]);

  return <TargetClient />;
}
