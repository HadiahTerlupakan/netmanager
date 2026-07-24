import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { runAsSystemContext } from "@/lib/tenant-context";
import type {
  BaileysSessionInfo,
  BaileysSessionStatus,
} from "./baileys-session-manager";

type SessionLookup = {
  status: BaileysSessionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock?: any;
};

type SessionAccess = {
  getLocalSession: (sessionId: string) => SessionLookup | undefined;
  readFromRedis: (sessionId: string) => Promise<BaileysSessionInfo | null>;
  dispatchRemoteCmd: (
    sessionId: string,
    cmd:
      | { type: "send"; phone: string; message: string }
      | {
          type: "send-file";
          phone: string;
          fileUrl: string;
          caption: string;
        },
  ) => Promise<{ success: boolean; messageId?: string; error?: string }>;
  startBaileysSession: (sessionId: string) => Promise<BaileysSessionInfo>;
};

let access: SessionAccess | null = null;

export function bindBaileysSessionSendAccess(next: SessionAccess): void {
  access = next;
}

function requireAccess(): SessionAccess {
  if (!access) {
    throw new Error("Baileys session send access is not bound");
  }
  return access;
}

function buildDisconnectedSessionError(
  sessionId: string,
  status?: BaileysSessionStatus | string,
): string {
  if (status === "needs_reauth" || status === "qr") {
    return `Session ${sessionId} perlu scan QR ulang (status: ${status})`;
  }
  if (status && status !== "disconnected") {
    return `Session ${sessionId} belum siap (status: ${status})`;
  }
  return `Session ${sessionId} belum terkoneksi`;
}

export async function sendBaileysMessage(
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { getLocalSession, readFromRedis, dispatchRemoteCmd } = requireAccess();
  const s = getLocalSession(sessionId);
  if (s && s.status === "connected" && s.sock) {
    try {
      const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
      const result = await s.sock.sendMessage(jid, { text: message });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Gagal kirim pesan",
      };
    }
  }

  const remote = await readFromRedis(sessionId);
  if (remote?.status === "connected") {
    return dispatchRemoteCmd(sessionId, {
      type: "send",
      phone,
      message,
    });
  }

  return {
    success: false,
    error: buildDisconnectedSessionError(
      sessionId,
      remote?.status ?? s?.status,
    ),
  };
}

export async function sendBaileysFile(
  sessionId: string,
  phone: string,
  fileUrl: string,
  caption: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { getLocalSession, readFromRedis, dispatchRemoteCmd } = requireAccess();
  const s = getLocalSession(sessionId);
  if (s && s.status === "connected" && s.sock) {
    try {
      const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
      const result = await s.sock.sendMessage(jid, {
        document: { url: fileUrl },
        mimetype: "application/octet-stream",
        fileName: "document",
        caption,
      });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Gagal kirim file",
      };
    }
  }

  const remote = await readFromRedis(sessionId);
  if (remote?.status === "connected") {
    return dispatchRemoteCmd(sessionId, {
      type: "send-file",
      phone,
      fileUrl,
      caption,
    });
  }

  return {
    success: false,
    error: buildDisconnectedSessionError(
      sessionId,
      remote?.status ?? s?.status,
    ),
  };
}

export async function restoreAllBaileySessions(): Promise<void> {
  const { startBaileysSession } = requireAccess();
  try {
    try {
      if (redis.status !== "ready") await redis.connect();
    } catch {
      // already connecting / ready
    }

    await runAsSystemContext("Baileys: restoreAllBaileySessions", async () => {
      const { prisma } = await import("@/lib/prisma");
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { provider: "BAILEYS", isActive: true },
        select: { id: true, name: true },
      });
      logger.info(`[Baileys] Restoring ${accounts.length} BAILEYS session(s)`);
      for (const account of accounts) {
        try {
          const info = await startBaileysSession(account.id);
          logger.info(
            `[Baileys] Restore ${account.id} (${account.name}): status=${info.status}`,
          );
        } catch (err) {
          logger.error(
            `[Baileys] Restore failed for ${account.id} (${account.name}):`,
            err,
          );
        }
      }
    });
  } catch (err) {
    logger.error("[Baileys] restoreAllBaileySessions failed:", err);
  }
}
