import {
  buildCreateFallbackProfile,
  closeConnectionSafely,
  connectRouterById,
  createConnectionErrorResult,
  createProfileOperationErrorResult,
  ensureCreateProfilePool,
  ensureUpdatedProfilePool,
  getCreateProfileParams,
  getProfileSetCommand,
  getTrapErrorMessage,
  getUpdateProfileParams,
  type MikroTikConnection,
  verifyProfileCreation,
  verifyProfileUpdate,
  warnRateLimitMismatch,
} from "./mikrotik-ppp-profile.lifecycle";
import type { PPPProfileData } from "./mikrotik/ppp-profile.types";

type ProfileOperationResult = { success: boolean; error?: string };
type WritableConnection = Pick<MikroTikConnection, "write">;
type ClosableConnection = Pick<MikroTikConnection, "close">;
type ExistingProfileUpdateParams = {
  conn: MikroTikConnection;
  existingProfile: Record<string, string>;
  profileName: string;
  profileData: Partial<PPPProfileData>;
};

type ProfileUpdateParams = {
  conn: MikroTikConnection;
  routerId: string;
  profileName: string;
  profileData: Partial<PPPProfileData>;
};

function closeAndReturn<T>(conn: ClosableConnection, result: T) {
  closeConnectionSafely(conn);
  return result;
}

async function findExistingProfiles(
  conn: WritableConnection,
  profileName: string,
) {
  return conn.write("/ppp/profile/print", [`?name=${profileName}`]);
}

function hasExistingProfile(profiles: unknown[]) {
  return Boolean(profiles[0]);
}

function createTrapResult(trapError: string) {
  return { success: false, error: trapError };
}

function createSuccessfulResult() {
  return { success: true };
}

function getProfileRecord(profiles: unknown[]) {
  return profiles[0] as Record<string, string>;
}

async function addProfile(
  conn: WritableConnection,
  profileData: PPPProfileData,
) {
  const paramsResult = getCreateProfileParams(profileData);
  if (paramsResult.ok === false) {
    return { success: false as const, error: paramsResult.error };
  }

  const result = await conn.write("/ppp/profile/add", paramsResult.params);
  const trapError = getTrapErrorMessage(result);
  return trapError ? createTrapResult(trapError) : null;
}

async function setProfile(
  conn: WritableConnection,
  profile: Record<string, string>,
  profileName: string,
  profileData: Partial<PPPProfileData>,
) {
  const updateParams = getUpdateProfileParams(profileName, profileData);
  if (updateParams.length === 0) {
    return createSuccessfulResult();
  }

  const result = await conn.write(
    "/ppp/profile/set",
    getProfileSetCommand(profile[".id"], updateParams),
  );
  const trapError = getTrapErrorMessage(result);
  return trapError ? createTrapResult(trapError) : null;
}

async function createProfileWithConnection(
  conn: MikroTikConnection,
  profileData: PPPProfileData,
): Promise<ProfileOperationResult> {
  const poolResult = await ensureCreateProfilePool(conn, profileData);
  if (!poolResult.success) return closeAndReturn(conn, poolResult);

  const addResult = await addProfile(conn, profileData);
  if (addResult) return closeAndReturn(conn, addResult);

  const verifyResult = await verifyProfileCreation(conn, profileData);
  if (!verifyResult.success) return closeAndReturn(conn, verifyResult);

  warnRateLimitMismatch(verifyResult.profile, profileData.rateLimit, "");
  return closeAndReturn(conn, createSuccessfulResult());
}

async function createProfileOnConnectedRouter(
  routerId: string,
  profileData: PPPProfileData,
): Promise<ProfileOperationResult> {
  const connectionResult = await connectRouterById(routerId);
  if (!connectionResult.success) {
    return connectionResult;
  }

  return createProfileWithConnection(connectionResult.conn, profileData);
}

async function createMissingUpdatedProfile(params: ProfileUpdateParams) {
  params.conn.close();
  return createProfileOnConnectedRouter(
    params.routerId,
    buildCreateFallbackProfile(params.profileName, params.profileData),
  );
}

async function verifyAndCompleteUpdatedProfile(
  params: ExistingProfileUpdateParams,
): Promise<ProfileOperationResult> {
  const verifyResult = await verifyProfileUpdate(
    params.conn,
    params.profileName,
    params.profileData,
  );
  if (!verifyResult.success) {
    return closeAndReturn(params.conn, verifyResult);
  }

  warnRateLimitMismatch(
    verifyResult.profile,
    params.profileData.rateLimit,
    "setelah update",
  );
  return closeAndReturn(params.conn, createSuccessfulResult());
}

async function finishExistingProfileUpdate(
  params: ExistingProfileUpdateParams,
): Promise<ProfileOperationResult> {
  const poolResult = await ensureUpdatedProfilePool(
    params.conn,
    params.existingProfile,
    params.profileData,
  );
  if (!poolResult.success) return closeAndReturn(params.conn, poolResult);

  const setResult = await setProfile(
    params.conn,
    params.existingProfile,
    params.profileName,
    params.profileData,
  );
  if (setResult) return closeAndReturn(params.conn, setResult);

  return verifyAndCompleteUpdatedProfile(params);
}

async function updateProfileWithConnection(
  params: ProfileUpdateParams,
): Promise<ProfileOperationResult> {
  const profiles = await findExistingProfiles(params.conn, params.profileName);
  if (!hasExistingProfile(profiles)) {
    return createMissingUpdatedProfile(params);
  }

  return finishExistingProfileUpdate({
    conn: params.conn,
    existingProfile: getProfileRecord(profiles),
    profileName: params.profileName,
    profileData: params.profileData,
  });
}

/** Buat profile PPP pada router MikroTik target. */
export async function createPPPProfileInMikroTik(
  routerId: string,
  profileData: PPPProfileData,
): Promise<ProfileOperationResult> {
  try {
    return await createProfileOnConnectedRouter(routerId, profileData);
  } catch (error) {
    return createConnectionErrorResult(
      error,
      "Gagal terhubung ke MikroTik Router",
    );
  }
}

/** Update profile PPP pada router MikroTik target. */
export async function updatePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  profileData: Partial<PPPProfileData>,
): Promise<ProfileOperationResult> {
  let conn: MikroTikConnection | null = null;

  try {
    const connectionResult = await connectRouterById(routerId);
    if (!connectionResult.success) {
      return connectionResult;
    }

    conn = connectionResult.conn;
    return await updateProfileWithConnection({
      conn,
      routerId,
      profileName,
      profileData,
    });
  } catch (error) {
    return createProfileOperationErrorResult(
      "updating",
      error,
      "Gagal mengupdate profile PPP di MikroTik",
    );
  } finally {
    if (conn) {
      closeConnectionSafely(conn);
    }
  }
}
