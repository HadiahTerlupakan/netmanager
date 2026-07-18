import { logger } from "@/lib/logger";

// WAMessageStatus enum values from proto.WebMessageInfo.Status
const WA_STATUS_DELIVERY_ACK = 3;
const WA_STATUS_READ = 4;
const WA_STATUS_PLAYED = 5;

interface BaileysMessageUpdate {
  key?: { id?: string; fromMe?: boolean | null };
  status?: number;
}

type DeliveryStatusRepo = {
  updateDeliveryStatus: (
    messageId: string,
    update: { status: "delivered" | "read"; timestamp?: Date },
  ) => Promise<void>;
};

export async function handleBaileysMessageStatusUpdates(
  sessionId: string,
  updates: BaileysMessageUpdate[],
): Promise<void> {
  const { WhatsAppMessageRepository } =
    await import("../../repositories/whatsapp-message.repository");
  const repo: DeliveryStatusRepo = new WhatsAppMessageRepository();

  for (const update of updates) {
    const keyId = update.key?.id;
    if (!keyId) continue;
    if (update.key?.fromMe === false) continue;

    const status = update.status;
    if (status === WA_STATUS_DELIVERY_ACK) {
      await safeUpdateDelivery(repo, sessionId, keyId, "delivered");
    } else if (status === WA_STATUS_READ || status === WA_STATUS_PLAYED) {
      await safeUpdateDelivery(repo, sessionId, keyId, "read");
    }
  }
}

async function safeUpdateDelivery(
  repo: DeliveryStatusRepo,
  sessionId: string,
  messageId: string,
  status: "delivered" | "read",
): Promise<void> {
  try {
    await repo.updateDeliveryStatus(messageId, { status });
  } catch (err) {
    logger.warn(
      `[Baileys] delivery update failed session=${sessionId} messageId=${messageId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
