import { ensureAnyPermission } from "@/lib/rbac";
import { IklanEditClient } from "./IklanEditClient";

export const metadata = {
  title: "Ubah Kampanye - Admin Portal",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureAnyPermission(["presurvei_iklan:update"]);
  const { id } = await params;

  return <IklanEditClient iklanId={id} />;
}
