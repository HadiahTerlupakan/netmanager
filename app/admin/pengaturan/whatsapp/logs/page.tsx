import { ensurePermission } from "@/lib/rbac";
import WhatsappLogsClient from "./WhatsappLogsClient";

export default async function WhatsappLogsPage() {
  await ensurePermission("whatsapp:read");
  return <WhatsappLogsClient />;
}
