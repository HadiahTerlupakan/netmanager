import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";
import { getResellerCommissionService } from "./ResellerCommissionService";

export async function handleInvoicePaidResellerCommission(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  if (
    typeof payload.invoiceId !== "string" ||
    typeof payload.pelangganId !== "string" ||
    typeof payload.amount !== "number" ||
    typeof payload.paidAt !== "string"
  ) {
    throw new Error("Payload invoice paid tidak valid untuk komisi reseller");
  }

  await getResellerCommissionService().accrueFromPaidInvoice({
    tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
    invoiceId: payload.invoiceId,
    pelangganId: payload.pelangganId,
    amount: payload.amount,
    paidAt: new Date(payload.paidAt),
  });
}
