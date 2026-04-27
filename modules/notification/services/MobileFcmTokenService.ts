import { PushTokenRepository } from "../repositories/PushTokenRepository";
import type {
  IMobileFcmSession,
  IPushTokenRepository,
} from "../domain/ports/IPushTokenRepository";

export class MobileFcmTokenError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const defaultRepository = new PushTokenRepository();

/** Adds or removes an FCM token for a mobile authenticated user. */
export async function updateMobileFcmToken(options: {
  session: IMobileFcmSession;
  fcmToken: string;
  action?: string;
  repository?: IPushTokenRepository;
}) {
  const userId = getSessionUserId(options.session);
  if (!userId) {
    throw new MobileFcmTokenError("Token tidak valid", 401);
  }

  const repository = options.repository ?? defaultRepository;
  const owner = await repository.findOwnerTokens(options.session, userId);
  if (!owner) {
    throw new MobileFcmTokenError("Pengguna mobile tidak ditemukan", 404);
  }

  const normalizedAction = options.action === "remove" ? "remove" : "add";
  await persistTokenChange({
    repository,
    session: options.session,
    userId,
    tokens: owner.fcmTokens,
    fcmToken: options.fcmToken,
    action: normalizedAction,
  });

  return { message: buildSuccessMessage(normalizedAction) };
}

function getSessionUserId(session: IMobileFcmSession) {
  return session.userId ?? session.id ?? null;
}

function buildSuccessMessage(action: "add" | "remove") {
  return action === "remove"
    ? "FCM token berhasil dihapus"
    : "FCM token berhasil disimpan";
}

function persistTokenChange(options: {
  repository: IPushTokenRepository;
  session: IMobileFcmSession;
  userId: string;
  tokens: string[];
  fcmToken: string;
  action: "add" | "remove";
}) {
  if (options.action === "remove") {
    return options.repository.replaceOwnerTokens(
      options.session,
      options.userId,
      options.tokens.filter((token) => token !== options.fcmToken),
    );
  }

  if (options.tokens.includes(options.fcmToken)) {
    return Promise.resolve();
  }

  return options.repository.appendOwnerToken(
    options.session,
    options.userId,
    options.fcmToken,
  );
}
