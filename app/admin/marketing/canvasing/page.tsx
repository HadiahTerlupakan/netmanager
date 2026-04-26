import { ensureAnyPermission } from "@/lib/rbac";
import CanvasingList from "./CanvasingList";

export const metadata = {
  title: "Canvasing - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["canvasing:read", "canvasing:verify"]);

  return <CanvasingList />;
}
