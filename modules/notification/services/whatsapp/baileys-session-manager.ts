import path from "path";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { runAsSystemContext } from "@/lib/tenant-context";

export type BaileysSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected"
  | "error"
  | "needs_reauth";

export interface BaileysSessionInfo {
  sessionId: string;
  status: BaileysSessionStatus;
  qr?: string;
  phone?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BaileysSock = any;

interface SessionEntry {
  status: BaileysSessionStatus;
  qr?: string;
  phone?: string;
  error?: string;
  sock?: BaileysSock;
  stop?: () => Promise<void>;
  qrWaiters?: Array<(info: BaileysSessionInfo) => void>;
  refreshInterval?: ReturnType<typeof setInterval>;
  lockHeartbeat?: ReturnType<typeof setInterval>;
}

const sessions = new Map<string, SessionEntry>();
const QR_TTL_SEC = 180;
const CONNECTED_TTL_SEC = 86400;
const QR_WAIT_MS = 25000;
const REFRESH_INTERVAL_MS = 240000;
const LOCK_TTL_SEC = 60;
const LOCK_HEARTBEAT_MS = 20000;

const POD_ID =
  process.env.HOSTNAME ?? `pod-${Math.random().toString(36).slice(2, 8)}`;

function redisKey(sessionId: string) {
  return `baileys:session:${sessionId}`;
}

function lockKey(sessionId: string) {
  return `baileys:lock:${sessionId}`;
}

function authDirFor(sessionId: string) {
  return path.resolve(process.cwd(), ".baileys-sessions", sessionId);
}

async function acquireLock(sessionId: string): Promise<boolean> {
  try {
    const key = lockKey(sessionId);
    const result = await redis.set(key, POD_ID, "EX", LOCK_TTL_SEC, "NX");
    return result === "OK";
  } catch {
    return true;
  }
}

async function releaseLock(sessionId: string): Promise<void> {
  try {
    const key = lockKey(sessionId);
    const owner = await redis.get(key);
    if (owner === POD_ID) await redis.del(key);
  } catch {
    // ignore
  }
}

async function renewLock(sessionId: string): Promise<void> {
  try {
    const key = lockKey(sessionId);
    const owner = await redis.get(key);
    if (owner === POD_ID) await redis.expire(key, LOCK_TTL_SEC);
  } catch {
    // ignore
  }
}

async function persist(sessionId: string, entry: SessionEntry): Promise<void> {
  const payload: BaileysSessionInfo = {
    sessionId,
    status: entry.status,
    qr: entry.qr,
    phone: entry.phone,
    error: entry.error,
  };
  const ttl = entry.status === "connected" ? CONNECTED_TTL_SEC : QR_TTL_SEC;
  try {
    await redis.set(redisKey(sessionId), JSON.stringify(payload), "EX", ttl);
  } catch (err) {
    logger.warn(
      `[Baileys] Redis persist failed for ${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function readFromRedis(
  sessionId: string,
): Promise<BaileysSessionInfo | null> {
  try {
    const raw = await redis.get(redisKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as BaileysSessionInfo;
  } catch {
    return null;
  }
}

function notifyWaiters(sessionId: string, entry: SessionEntry) {
  const waiters = entry.qrWaiters ?? [];
  entry.qrWaiters = [];
  const info: BaileysSessionInfo = {
    sessionId,
    status: entry.status,
    qr: entry.qr,
    phone: entry.phone,
    error: entry.error,
  };
  for (const resolve of waiters) resolve(info);
}

export async function getBaileysSession(
  sessionId: string,
): Promise<BaileysSessionInfo> {
  const local = sessions.get(sessionId);
  if (local && (local.status === "qr" || local.status === "connected")) {
    return {
      sessionId,
      status: local.status,
      qr: local.qr,
      phone: local.phone,
      error: local.error,
    };
  }

  const remote = await readFromRedis(sessionId);
  if (remote) return remote;

  if (local) {
    return {
      sessionId,
      status: local.status,
      qr: local.qr,
      phone: local.phone,
      error: local.error,
    };
  }

  return { sessionId, status: "disconnected" };
}

export async function listBaileysSessions(): Promise<BaileysSessionInfo[]> {
  return Promise.all(
    Array.from(sessions.keys()).map((id) => getBaileysSession(id)),
  );
}

export async function clearBaileysAuthState(sessionId: string): Promise<void> {
  const authDir = authDirFor(sessionId);
  try {
    const fs = await import("fs/promises");
    await fs.rm(authDir, { recursive: true, force: true });
    logger.info(`[Baileys] Cleared auth state for session ${sessionId}`);
  } catch (err) {
    logger.warn(
      `[Baileys] Failed to clear auth state for ${sessionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export async function startBaileysSession(
  sessionId: string,
  options?: { forcePairing?: boolean },
): Promise<BaileysSessionInfo> {
  const existing = sessions.get(sessionId);
  if (existing?.status === "connected" && !options?.forcePairing) {
    return getBaileysSession(sessionId);
  }
  if (existing?.status === "qr" && existing.qr && !options?.forcePairing) {
    return {
      sessionId,
      status: "qr",
      qr: existing.qr,
      phone: existing.phone,
    };
  }

  if (
    (existing?.status === "connecting" || existing?.status === "qr") &&
    !options?.forcePairing
  ) {
    return waitForQrOrTerminal(sessionId, existing);
  }

  if (
    options?.forcePairing ||
    existing?.status === "needs_reauth" ||
    existing?.status === "error"
  ) {
    if (existing?.lockHeartbeat) clearInterval(existing.lockHeartbeat);
    if (existing?.refreshInterval) clearInterval(existing.refreshInterval);
    if (existing?.stop) {
      try {
        await existing.stop();
      } catch {
        /* ignore */
      }
    }
    sessions.delete(sessionId);
    await releaseLock(sessionId);
    await clearBaileysAuthState(sessionId);
  }

  if (!options?.forcePairing) {
    const remote = await readFromRedis(sessionId);
    if (remote?.status === "needs_reauth") {
      await clearBaileysAuthState(sessionId);
    }
  }

  const hasLock = await acquireLock(sessionId);
  if (!hasLock) {
    logger.info(
      `[Baileys] Pod ${POD_ID} skipped session ${sessionId} — owned by another pod`,
    );
    const remote = await readFromRedis(sessionId);
    return remote ?? { sessionId, status: "disconnected" };
  }

  const entry: SessionEntry = {
    status: "connecting",
    qrWaiters: [],
    lockHeartbeat: setInterval(
      () => void renewLock(sessionId),
      LOCK_HEARTBEAT_MS,
    ),
  };
  sessions.set(sessionId, entry);
  await persist(sessionId, entry);

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default;
    const {
      useMultiFileAuthState: loadAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      Browsers,
    } = baileys;

    const authDir = authDirFor(sessionId);
    const { state, saveCreds } = await loadAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    let pinoLogger: unknown = undefined;
    try {
      const pino = (await import("pino")).default;
      pinoLogger = pino({ level: "silent" });
    } catch {
      pinoLogger = undefined;
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      ...(pinoLogger ? { logger: pinoLogger as never } : {}),
    });

    entry.sock = sock;
    entry.stop = async () => {
      try {
        sock.end(undefined);
      } catch {
        /* ignore */
      }
    };
    sessions.set(sessionId, entry);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      const current = sessions.get(sessionId) ?? entry;

      if (qr) {
        void import("qrcode")
          .then(({ toDataURL }) => toDataURL(qr))
          .then((dataUrl) => {
            current.qr = dataUrl;
            current.status = "qr";
            current.error = undefined;
            sessions.set(sessionId, current);
            void persist(sessionId, current);
            notifyWaiters(sessionId, current);
            logger.info(`[Baileys] QR ready for session ${sessionId}`);
          })
          .catch((err) => {
            logger.error(`[Baileys] QR encode failed ${sessionId}:`, err);
            current.status = "error";
            current.error =
              err instanceof Error ? err.message : "Gagal encode QR";
            sessions.set(sessionId, current);
            void persist(sessionId, current);
            notifyWaiters(sessionId, current);
          });
      }

      if (connection === "open") {
        const phone = sock.user?.id?.split(":")[0]?.split("@")[0] ?? undefined;
        current.status = "connected";
        current.phone = phone;
        current.qr = undefined;
        current.error = undefined;
        if (current.refreshInterval) clearInterval(current.refreshInterval);
        current.refreshInterval = setInterval(() => {
          void persist(sessionId, current);
          void renewLock(sessionId);
        }, REFRESH_INTERVAL_MS);
        sessions.set(sessionId, current);
        void persist(sessionId, current);
        notifyWaiters(sessionId, current);
        logger.info(
          `[Baileys] Session ${sessionId} connected (${phone}) pod=${POD_ID}`,
        );
      }

      if (connection === "close") {
        const code = (
          lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        if (current.refreshInterval) {
          clearInterval(current.refreshInterval);
          current.refreshInterval = undefined;
        }
        if (current.lockHeartbeat) {
          clearInterval(current.lockHeartbeat);
          current.lockHeartbeat = undefined;
        }
        if (loggedOut) {
          current.status = "needs_reauth";
          current.error =
            "Session logged out oleh WhatsApp. Scan QR ulang dari UI.";
          void clearBaileysAuthState(sessionId);
        } else {
          current.status = "disconnected";
          current.error = undefined;
        }
        current.qr = undefined;
        current.sock = undefined;
        sessions.set(sessionId, current);
        void persist(sessionId, current);
        void releaseLock(sessionId);
        notifyWaiters(sessionId, current);
        logger.warn(
          `[Baileys] Session ${sessionId} closed (code ${code}) pod=${POD_ID}`,
        );
        if (!loggedOut) {
          setTimeout(() => {
            void startBaileysSession(sessionId);
          }, 5000);
        }
      }
    });
  } catch (err) {
    logger.error(`[Baileys] Failed to start session ${sessionId}:`, err);
    if (entry.lockHeartbeat) {
      clearInterval(entry.lockHeartbeat);
      entry.lockHeartbeat = undefined;
    }
    entry.status = "error";
    entry.error = err instanceof Error ? err.message : "Gagal start Baileys";
    sessions.set(sessionId, entry);
    await persist(sessionId, entry);
    await releaseLock(sessionId);
    notifyWaiters(sessionId, entry);
    return getBaileysSession(sessionId);
  }

  return waitForQrOrTerminal(sessionId, entry);
}

function waitForQrOrTerminal(
  sessionId: string,
  entry: SessionEntry,
): Promise<BaileysSessionInfo> {
  if (
    entry.status === "qr" ||
    entry.status === "connected" ||
    entry.status === "error" ||
    entry.status === "needs_reauth"
  ) {
    return Promise.resolve({
      sessionId,
      status: entry.status,
      qr: entry.qr,
      phone: entry.phone,
      error: entry.error,
    });
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const current = sessions.get(sessionId) ?? entry;
      if (current.status === "connecting") {
        current.status = "error";
        current.error = "QR belum muncul dalam 25 detik. Coba Start lagi.";
        sessions.set(sessionId, current);
        void persist(sessionId, current);
      }
      resolve({
        sessionId,
        status: current.status,
        qr: current.qr,
        phone: current.phone,
        error: current.error,
      });
    }, QR_WAIT_MS);

    entry.qrWaiters = entry.qrWaiters ?? [];
    entry.qrWaiters.push((info) => {
      clearTimeout(timer);
      resolve(info);
    });
  });
}

export async function stopBaileysSession(sessionId: string): Promise<void> {
  const s = sessions.get(sessionId);
  if (s?.lockHeartbeat) clearInterval(s.lockHeartbeat);
  if (s?.refreshInterval) clearInterval(s.refreshInterval);
  if (s?.stop) await s.stop();
  sessions.delete(sessionId);
  await releaseLock(sessionId);
  try {
    await redis.del(redisKey(sessionId));
  } catch {
    // ignore
  }
}

export async function sendBaileysMessage(
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const s = sessions.get(sessionId);
  if (!s || s.status !== "connected" || !s.sock) {
    return {
      success: false,
      error: `Session ${sessionId} belum terkoneksi di pod ini`,
    };
  }
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

export async function sendBaileysFile(
  sessionId: string,
  phone: string,
  fileUrl: string,
  caption: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const s = sessions.get(sessionId);
  if (!s || s.status !== "connected" || !s.sock) {
    return {
      success: false,
      error: `Session ${sessionId} belum terkoneksi di pod ini`,
    };
  }
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

export function onBaileysQR(_cb: (sessionId: string, qr: string) => void) {
  // no-op: status now polled via Redis
}

export function onBaileysStatus(
  _cb: (sessionId: string, status: BaileysSessionStatus) => void,
) {
  // no-op
}

export async function restoreAllBaileySessions(): Promise<void> {
  try {
    await runAsSystemContext("Baileys: restoreAllBaileySessions", async () => {
      const { prisma } = await import("@/lib/prisma");
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { provider: "BAILEYS", isActive: true },
        select: { id: true, name: true },
      });
      logger.info(
        `[Baileys] Restoring ${accounts.length} BAILEYS session(s) pod=${POD_ID}`,
      );
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
