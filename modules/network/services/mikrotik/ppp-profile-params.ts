import type { PPPProfileData } from "./ppp-profile.types";

export type ProfileParamsResult =
  | { ok: true; params: string[] }
  | { ok: false; error: string };

/** Build RouterOS add params for PPP profile creation. */
export function buildCreateProfileParams(
  profileData: PPPProfileData,
): ProfileParamsResult {
  const validation = validateRequiredCreateFields(profileData);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  const params = [
    `=name=${profileData.name}`,
    `=local-address=${profileData.localAddress}`,
    `=comment=add by netmanager - ${profileData.name}`,
  ];
  appendRemoteAddress(params, profileData);
  appendOptionalCreateParams(params, profileData);
  return { ok: true, params };
}

/** Build RouterOS set params for PPP profile updates. */
export function buildUpdateProfileParams(
  profileName: string,
  profileData: Partial<PPPProfileData>,
): string[] {
  const params: string[] = [];
  appendNameUpdate(params, profileName, profileData.name);
  appendOptionalUpdateParams(params, profileData);
  params.push(
    `=comment=add by netmanager - ${profileData.name || profileName}`,
  );
  return params;
}

type ProfileValidationResult = { ok: true } | { ok: false; error: string };

function validateRequiredCreateFields(
  profileData: PPPProfileData,
): ProfileValidationResult {
  if (!profileData.name?.trim()) {
    return { ok: false, error: "Nama profile tidak boleh kosong" };
  }
  if (!profileData.localAddress?.trim()) {
    return { ok: false, error: "Local address tidak boleh kosong" };
  }
  if (!profileData.skipPoolCheck && !profileData.remoteAddress?.trim()) {
    return {
      ok: false,
      error: "Remote address (nama IP Pool) tidak boleh kosong",
    };
  }
  return { ok: true };
}

function appendRemoteAddress(params: string[], profileData: PPPProfileData) {
  if (!profileData.skipPoolCheck) {
    params.push(`=remote-address=${profileData.remoteAddress}`);
  }
}

function appendOptionalCreateParams(
  params: string[],
  profileData: PPPProfileData,
) {
  if (profileData.dnsServer?.trim()) {
    params.push(`=dns-server=${profileData.dnsServer}`);
  }
  if (profileData.sessionTimeout) {
    params.push(`=session-timeout=${profileData.sessionTimeout}`);
  }
  if (profileData.idleTimeout) {
    params.push(`=idle-timeout=${profileData.idleTimeout}`);
  }
  if (shouldApplyRateLimit(profileData)) {
    params.push(`=rate-limit=${profileData.rateLimit}`);
  }
}

function appendNameUpdate(
  params: string[],
  profileName: string,
  nextName?: string,
) {
  if (nextName !== undefined && nextName !== profileName) {
    params.push(`=name=${nextName}`);
  }
}

function appendOptionalUpdateParams(
  params: string[],
  profileData: Partial<PPPProfileData>,
) {
  appendNullableParam(params, "local-address", profileData.localAddress);
  appendRemoteAddressUpdate(params, profileData);
  appendNullableParam(params, "dns-server", profileData.dnsServer);
  appendNullableParam(params, "session-timeout", profileData.sessionTimeout);
  appendNullableParam(params, "idle-timeout", profileData.idleTimeout);
  appendRateLimitUpdate(params, profileData);
}

function appendRemoteAddressUpdate(
  params: string[],
  profileData: Partial<PPPProfileData>,
) {
  if (profileData.skipPoolCheck) {
    params.push("=remote-address=");
    return;
  }
  appendNullableParam(params, "remote-address", profileData.remoteAddress);
}

function appendRateLimitUpdate(
  params: string[],
  profileData: Partial<PPPProfileData>,
) {
  if (profileData.skipRateLimit || profileData.skipPoolCheck) {
    params.push("=rate-limit=");
    return;
  }
  appendNullableParam(params, "rate-limit", profileData.rateLimit);
}

function appendNullableParam(
  params: string[],
  key: string,
  value: string | number | null | undefined,
) {
  if (value === undefined) return;
  if (value === null || value === "") {
    params.push(`=${key}=`);
    return;
  }
  params.push(`=${key}=${value}`);
}

function shouldApplyRateLimit(profileData: PPPProfileData) {
  return (
    !profileData.skipRateLimit &&
    !profileData.skipPoolCheck &&
    Boolean(profileData.rateLimit?.trim())
  );
}
