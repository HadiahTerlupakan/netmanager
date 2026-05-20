import { ensurePermission } from "@/lib/rbac";
import { ManualJournalClient } from "./ManualJournalClient";

export default async function NewJournalPage() {
  await ensurePermission("journal:create");
  return <ManualJournalClient />;
}
