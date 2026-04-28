import { receivablesPageService } from "@/modules/finance";
import ReceivablesClient from "./ReceivablesClient";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  const receivables = await receivablesPageService.getReceivables();

  return <ReceivablesClient initialData={receivables} />;
}
