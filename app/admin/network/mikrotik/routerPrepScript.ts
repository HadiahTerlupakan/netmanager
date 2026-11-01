import type { PppConnectionMode } from "@/app/admin/network/mikrotik/mikrotikFormShared";
import { quoteRouterOs } from "@/modules/network/routeros";

const USER_COMMENT = "NetManager";
const USER_EXISTS_MESSAGE = "User API sudah ada di router; tidak diubah";

/** Isi form yang menentukan script persiapan router publik. */
export type RouterPrepScriptInput = {
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  pppConnectionMode: PppConnectionMode;
};

// User yang sudah ada (biasanya admin) tidak pernah diubah: password yang salah
// ketik di form akan mengunci pemiliknya dari router sendiri.
function addUserIfAbsentLine(username: string, password: string): string {
  const name = quoteRouterOs(username);
  const fields = `name=${name} group=full password=${quoteRouterOs(password)} comment=${quoteRouterOs(USER_COMMENT)}`;
  return `:if ([:len [/user find name=${name}]] = 0) do={ /user add ${fields} } else={ :put ${quoteRouterOs(USER_EXISTS_MESSAGE)} }`;
}

/**
 * Script yang ditempel operator di terminal router publik sebelum Tes Koneksi:
 * service API dan user API sesuai form. RADIUS, CoA, firewall, dan halaman
 * isolir tidak ada di sini karena dipasang NetManager saat router disimpan.
 * `null` bila username atau password belum diisi.
 */
export function buildRouterPrepScript(
  input: RouterPrepScriptInput,
): string | null {
  if (!input.apiUsername.trim() || !input.apiPassword) return null;
  const lines = [
    `/ip service set [find name=api] disabled=no port=${input.apiPort}`,
    addUserIfAbsentLine(input.apiUsername, input.apiPassword),
  ];
  // Provisioning tidak menyentuh /ppp aaa; tanpa ini PPPoE tidak bertanya ke RADIUS.
  if (input.pppConnectionMode === "RADIUS") {
    lines.push("/ppp aaa set use-radius=yes");
  }
  return `${lines.join("\n")}\n`;
}
