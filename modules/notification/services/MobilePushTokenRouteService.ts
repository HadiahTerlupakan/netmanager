import type {
  IMobileFcmSession,
  IPushTokenRepository,
} from "../domain/ports/IPushTokenRepository";
import { PushTokenRepository } from "../repositories/PushTokenRepository";

const PUSH_TOKEN_ADDED_MESSAGE = "Push token terdaftar";
const PUSH_TOKEN_REMOVED_MESSAGE = "Push token dihapus";
const defaultPushTokenRepository: IPushTokenRepository =
  new PushTokenRepository();

/** Mendaftarkan push token mobile lama sambil menjaga token tetap unik. */
export async function registerMobilePushToken(
  session: IMobileFcmSession,
  pushToken: string,
  repository: IPushTokenRepository = defaultPushTokenRepository,
) {
  await repository.clearLegacyPushTokenOwners({
    userId: session.id ?? "",
    tenantId: session.tenantId ?? null,
    pushToken,
  });
  await repository.updateLegacyOwnerPushToken(session, pushToken);
  return { message: PUSH_TOKEN_ADDED_MESSAGE };
}

/** Menghapus push token mobile lama saat logout. */
export async function removeMobilePushToken(
  session: IMobileFcmSession,
  repository: IPushTokenRepository = defaultPushTokenRepository,
) {
  await repository.updateLegacyOwnerPushToken(session, null);
  return { message: PUSH_TOKEN_REMOVED_MESSAGE };
}
