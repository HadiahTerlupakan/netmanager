import path from "path";
import { logger } from "@/lib/logger";

export type BaileysSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected";

export interface BaileysSessionInfo {
  sessionId: string;
  status: BaileysSessionStatus;
  qr?: string;
  phone?: string;
}

type QRCallback = (sessionId: string, qr: string) => void;
type StatusCallback = (sessionId: string, status: BaileysSessionStatus) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BaileysSock = any;

interface SessionEntry {
  status: BaileysSessionStatus;
  qr?: string;
  phone?: string;
  sock?: BaileysSock;
  stop?: () => Promise<void>;
}

const sessions = new Map<string, SessionEntry>();
let onQR: QRCallback | undefined;
let onStatus: StatusCallback | undefined;

export function onBaileysQR(cb: QRCallback) {
  onQR = cb;
}

export function onBaileysStatus(cb: StatusCallback) {
  onStatus = cb;
}

export function getBaileysSession(sessionId: string): BaileysSessionInfo {
  const s = sessions.get(sessionId);
  return {
    sessionId,
    status: s?.status ?? "disconnected",
    qr: s?.qr,
    phone: s?.phone,
  };
}

export function listBaileysSessions(): BaileysSessionInfo[] {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    sessionId: id,
    status: s.status,
    qr: s.qr,
    phone: s.phone,
  }));
}

export async function startBaileysSession(sessionId: string): Promise<void> {
  const existing = sessions.get(sessionId);
  if (existing?.status === "connected" || existing?.status === "connecting") {
    return;
  }

  sessions.set(sessionId, { status: "connecting" });
  onStatus?.(sessionId, "connecting");

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default;
    const {
      useMultiFileAuthState: loadAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = baileys;

    const authDir = path.resolve(process.cwd(), ".baileys-sessions", sessionId);
    const { state, saveCreds } = await loadAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: { level: "silent" } as never,
    });

    const entry: SessionEntry = {
      status: "connecting",
      sock,
      stop: async () => sock.end(undefined),
    };
    sessions.set(sessionId, entry);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        import("qrcode").then(({ toDataURL }) =>
          toDataURL(qr).then((dataUrl) => {
            const s = sessions.get(sessionId);
            if (s) {
              s.qr = dataUrl;
              s.status = "qr";
            }
            onQR?.(sessionId, dataUrl);
            onStatus?.(sessionId, "qr");
          }),
        );
      }

      if (connection === "open") {
        const phone = sock.user?.id?.split(":")[0]?.split("@")[0] ?? undefined;
        const s = sessions.get(sessionId);
        if (s) {
          s.status = "connected";
          s.phone = phone;
          s.qr = undefined;
        }
        onStatus?.(sessionId, "connected");
        logger.info(`[Baileys] Session ${sessionId} connected (${phone})`);
      }

      if (connection === "close") {
        const code = (
          lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        sessions.set(sessionId, { status: "disconnected" });
        onStatus?.(sessionId, "disconnected");
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
    sessions.set(sessionId, { status: "disconnected" });
    onStatus?.(sessionId, "disconnected");
  }
}

export async function stopBaileysSession(sessionId: string): Promise<void> {
  const s = sessions.get(sessionId);
  if (s?.stop) await s.stop();
  sessions.delete(sessionId);
  onStatus?.(sessionId, "disconnected");
}

export async function sendBaileysMessage(
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const s = sessions.get(sessionId);
  if (!s || s.status !== "connected" || !s.sock) {
    return { success: false, error: `Session ${sessionId} belum terkoneksi` };
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
    return { success: false, error: `Session ${sessionId} belum terkoneksi` };
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
