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

type MobileFcmTokenOptions = {
  session: IMobileFcmSession;
  fcmToken: string;
  action?: string;
  repository?: IPushTokenRepository;
  successMessages?: {
    add: string;
    remove: string;
  };
};

/** Adds or removes an FCM token for a mobile authenticated user. */
export async function updateMobileFcmToken(options: MobileFcmTokenOptions) {
  const context = await buildMobileFcmTokenContext(options);
  await persistTokenChange(context);
  return {
    message: buildSuccessMessage(context.action, options.successMessages),
  };
}

async function buildMobileFcmTokenContext(options: MobileFcmTokenOptions) {
  const userId = requireSessionUserId(options.session);
  const repository = options.repository ?? defaultRepository;
  const owner = await findMobileTokenOwner(repository, options.session, userId);
  return {
    repository,
    session: options.session,
    userId,
    tokens: owner.fcmTokens,
    fcmToken: options.fcmToken,
    action: normalizeTokenAction(options.action),
  };
}

function normalizeTokenAction(action?: string): "add" | "remove" {
  return action === "remove" ? "remove" : "add";
}

function requireSessionUserId(session: IMobileFcmSession): string {
  const userId = getSessionUserId(session);
  if (!userId) {
    throw new MobileFcmTokenError("Token tidak valid", 401);
  }
  return userId;
}

async function findMobileTokenOwner(
  repository: IPushTokenRepository,
  session: IMobileFcmSession,
  userId: string,
) {
  const owner = await repository.findOwnerTokens(session, userId);
  if (!owner) {
    throw new MobileFcmTokenError("Pengguna mobile tidak ditemukan", 404);
  }
  return owner;
}

function getSessionUserId(session: IMobileFcmSession) {
  return session.userId ?? session.id ?? null;
}

function buildSuccessMessage(
  action: "add" | "remove",
  successMessages?: { add: string; remove: string },
) {
  if (action === "remove") {
    return successMessages?.remove ?? "FCM token berhasil dihapus";
  }

  return successMessages?.add ?? "FCM token berhasil disimpan";
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
    return removeMobileFcmToken(options);
  }
  if (options.tokens.includes(options.fcmToken)) {
    return Promise.resolve();
  }
  return appendMobileFcmToken(options);
}

function removeMobileFcmToken(options: {
  repository: IPushTokenRepository;
  session: IMobileFcmSession;
  userId: string;
  tokens: string[];
  fcmToken: string;
}) {
  return options.repository.replaceOwnerTokens(
    options.session,
    options.userId,
    options.tokens.filter((token) => token !== options.fcmToken),
  );
}

function appendMobileFcmToken(options: {
  repository: IPushTokenRepository;
  session: IMobileFcmSession;
  userId: string;
  fcmToken: string;
}) {
  return options.repository.appendOwnerToken(
    options.session,
    options.userId,
    options.fcmToken,
  );
}
