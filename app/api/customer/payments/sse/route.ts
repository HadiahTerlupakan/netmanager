import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerPaymentStreamStatus } from "@/modules/pelanggan";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireCustomerAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");

  if (!invoiceId) {
    return new Response("Missing invoiceId", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let keepChecking = true;

      controller.enqueue("event: connected\ndata: connected\n\n");

      const timeout = setTimeout(
        () => {
          keepChecking = false;
          try {
            controller.close();
          } catch (_error) {
            /* ignore */
          }
        },
        30 * 60 * 1000,
      );

      request.signal.addEventListener("abort", () => {
        keepChecking = false;
        clearTimeout(timeout);
        try {
          controller.close();
        } catch (_error) {
          /* ignore */
        }
      });

      while (keepChecking) {
        try {
          const status = await getCustomerPaymentStreamStatus({
            invoiceId,
            customerId: authResult.session.id,
          });

          if (!status) {
            keepChecking = false;
            clearTimeout(timeout);
            try {
              controller.close();
            } catch (_error) {
              /* ignore */
            }
            break;
          }

          controller.enqueue(`data: ${JSON.stringify({ status })}\n\n`);

          if (status === "PAID" || status === "FAILED") {
            keepChecking = false;
            clearTimeout(timeout);
            try {
              controller.close();
            } catch (_error) {
              /* ignore */
            }
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (error) {
          console.error("[SSE Generator Error]:", error);
          keepChecking = false;
          clearTimeout(timeout);
          try {
            controller.close();
          } catch (_error) {
            /* ignore */
          }
          break;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
