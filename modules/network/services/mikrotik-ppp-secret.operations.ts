import type { PPPSecretData } from "./mikrotik/ppp-secret.types";
import type { MikroTikOperationResult } from "./mikrotik-ppp-secret.helpers";

const DEFAULT_COMMENT = "added by netmanager";

type RouterRecord = Record<string, string>;

export async function upsertSecret(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  data: PPPSecretData,
): Promise<MikroTikOperationResult> {
  const existingSecrets = (await connection.write("/ppp/secret/print", [
    `?name=${data.name}`,
  ])) as RouterRecord[];

  if (existingSecrets[0]?.[".id"]) {
    await connection.write("/ppp/secret/set", [
      `=.id=${existingSecrets[0][".id"]}`,
      `=password=${data.password}`,
      `=profile=${data.profile}`,
      `=comment=${data.comment || DEFAULT_COMMENT}`,
    ]);
    return { success: true };
  }

  await connection.write("/ppp/secret/add", [
    `=name=${data.name}`,
    `=password=${data.password}`,
    `=profile=${data.profile}`,
    `=service=${data.service || "pppoe"}`,
    `=comment=${data.comment || DEFAULT_COMMENT}`,
  ]);
  return { success: true };
}

export async function updateSecretProfile(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  username: string,
  profileName: string,
): Promise<MikroTikOperationResult> {
  const secrets = (await connection.write("/ppp/secret/print", [
    `?name=${username}`,
  ])) as RouterRecord[];

  if (!secrets[0]?.[".id"]) {
    return { success: false, error: "PPP Secret tidak ditemukan" };
  }

  await connection.write("/ppp/secret/set", [
    `=.id=${secrets[0][".id"]}`,
    `=profile=${profileName}`,
  ]);
  return { success: true };
}

export async function removeSecretAndSessions(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  username: string,
): Promise<MikroTikOperationResult> {
  const secrets = (await connection.write("/ppp/secret/print", [
    `?name=${username}`,
  ])) as RouterRecord[];

  for (const secret of secrets) {
    if (!secret[".id"]) continue;
    await connection.write("/ppp/secret/remove", [`=.id=${secret[".id"]}`]);
  }

  const sessions = (await connection.write("/ppp/active/print", [
    `?name=${username}`,
  ])) as RouterRecord[];

  for (const session of sessions) {
    if (!session[".id"]) continue;
    await connection.write("/ppp/active/remove", [`=.id=${session[".id"]}`]);
  }

  return { success: true };
}
