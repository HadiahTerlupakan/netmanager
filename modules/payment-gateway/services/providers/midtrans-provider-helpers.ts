import midtransClient from "midtrans-client";
import type {
  ProviderConfig,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";

export function mapMidtransStatus(
  transactionStatus: string | undefined,
): TransactionStatus["status"] {
  switch (transactionStatus) {
    case "capture":
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
      return "CANCELLED";
    case "expire":
      return "EXPIRED";
    default:
      return "FAILED";
  }
}

export function buildMidtransWebhookResult(
  payload: Record<string, unknown>,
): WebhookResult {
  const status = mapMidtransStatus(
    payload.transaction_status as string | undefined,
  );

  return {
    orderId: payload.order_id as string,
    status,
    ...(status === "PAID"
      ? { paidAt: new Date(payload.transaction_time as string) }
      : {}),
    paymentMethod: payload.payment_type as string,
    transactionId: payload.transaction_id as string,
    amount: parseFloat(payload.gross_amount as string),
    raw: payload,
  };
}

export function buildMidtransCoreApi(config: ProviderConfig) {
  return new midtransClient.CoreApi({
    isProduction: config.isProduction,
    serverKey: config.apiKey,
    clientKey: config.clientKey,
  });
}

export async function testMidtransConnection(config: ProviderConfig) {
  const testCoreApi = buildMidtransCoreApi(config) as unknown as {
    transaction: { status: (id: string) => Promise<unknown> };
  };

  try {
    await testCoreApi.transaction.status("test-order-id");
  } catch (error: unknown) {
    return buildMidtransConnectionResult(error, config);
  }

  return buildSuccessfulMidtransConnectionResult(config);
}

function buildMidtransConnectionResult(error: unknown, config: ProviderConfig) {
  const err = error as Record<string, unknown>;

  if (isValidMidtransCredentialError(err)) {
    return buildSuccessfulMidtransConnectionResult(config);
  }

  if (err.httpStatusCode === 401) {
    return {
      success: false,
      message: "API key tidak valid",
      details: {
        error: "Tidak terautentikasi",
      },
    };
  }

  return buildSuccessfulMidtransConnectionResult(config);
}

function isValidMidtransCredentialError(err: Record<string, unknown>) {
  return (
    err.httpStatusCode === 404 ||
    (err.ApiResponse as Record<string, unknown>)?.status_code === "404"
  );
}

function buildSuccessfulMidtransConnectionResult(config: ProviderConfig) {
  return {
    success: true,
    message: "Connection successful",
    details: {
      environment: config.isProduction ? "Production" : "Sandbox",
    },
  };
}
