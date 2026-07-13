import path from "path";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

export type BaileysSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected"
  | "error";

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
}

const sessions = new Map<string, SessionEntry>();
const REDIS_TTL_SEC = 300;
const QR_WAIT_MS = 25000;

function redisKey(sessionId: string) {
  return `baileys:session:${sessionId}`;
}

async function persist(sessionId: string, entry: SessionEntry): Promise<void> {
  const payload: BaileysSessionInfo = {
    sessionId,
    status: entry.status,
    qr: entry.qr,
    phone: entry.phone,
    error: entry.error,
  };
  try {
    await redis.set(
      redisKey(sessionId),
      JSON.stringify(payload),
      "EX",
      REDIS_TTL_SEC,
    );
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

export async function startBaileysSession(
  sessionId: string,
): Promise<BaileysSessionInfo> {
  const existing = sessions.get(sessionId);
  if (existing?.status === "connected") {
    return getBaileysSession(sessionId);
  }
  if (existing?.status === "qr" && existing.qr) {
    return {
      sessionId,
      status: "qr",
      qr: existing.qr,
      phone: existing.phone,
    };
  }

  // If already connecting on THIS pod, wait for QR instead of no-op.
  if (existing?.status === "connecting" || existing?.status === "qr") {
    return waitForQrOrTerminal(sessionId, existing);
  }

  const entry: SessionEntry = {
    status: "connecting",
    qrWaiters: [],
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

    const authDir = path.resolve(process.cwd(), ".baileys-sessions", sessionId);
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
        // ignore
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
        sessions.set(sessionId, current);
        void persist(sessionId, current);
        notifyWaiters(sessionId, current);
        logger.info(`[Baileys] Session ${sessionId} connected (${phone})`);
      }

      if (connection === "close") {
        const code = (
          lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        current.status = "disconnected";
        current.qr = undefined;
        current.sock = undefined;
        sessions.set(sessionId, current);
        void persist(sessionId, current);
        notifyWaiters(sessionId, current);
        logger.warn(`[Baileys] Session ${sessionId} closed (code ${code})`);
        if (!loggedOut) {
          setTimeout(() => {
            void startBaileysSession(sessionId);
          }, 5000);
        }
      }
    });
  } catch (err) {
    logger.error(`[Baileys] Failed to start session ${sessionId}:`, err);
    entry.status = "error";
    entry.error = err instanceof Error ? err.message : "Gagal start Baileys";
    sessions.set(sessionId, entry);
    await persist(sessionId, entry);
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
    entry.status === "error"
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
      resolve({
        sessionId,
        status: current.status,
        qr: current.qr,
        phone: current.phone,
        error:
          current.error ??
          (current.status === "connecting"
            ? "QR belum muncul dalam 25 detik. Coba Start lagi."
            : undefined),
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
  if (s?.stop) await s.stop();
  sessions.delete(sessionId);
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
      error: `Session ${sessionId} belum terkoneksi di pod ini. Pastikan sessionAffinity aktif atau gunakan 1 replica.`,
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
      error: `Session ${sessionId} belum terkoneksi di pod ini. Pastikan sessionAffinity aktif atau gunakan 1 replica.`,
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

// Keep sync wrappers for callers that still use the old names via re-exports.
export function onBaileysQR(_cb: (sessionId: string, qr: string) => void) {
  // no-op: status now polled via Redis
}

export function onBaileysStatus(
  _cb: (sessionId: string, status: BaileysSessionStatus) => void,
) {
  // no-op
}
