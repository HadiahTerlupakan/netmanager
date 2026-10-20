const API_GROUP = "netmanager-api";
const API_GROUP_POLICY = "read,write,api,test,policy,sensitive";
const API_SERVICE_PORT = 8728;
const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;
const HEX_RADIX = 16;

/** Cara skrip membuat user API: `create` membuat grup+user, `extend` hanya menambah alamat core. */
export type VpnApiUserScriptMode = "create" | "extend";

export interface VpnApiUserScriptInput {
  username: string;
  password?: string;
  coreAddress: string;
  mode: VpnApiUserScriptMode;
}

const ESCAPED_WITH_BACKSLASH = new Set(["\\", '"', "$", "?"]);
const NAMED_ESCAPES: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

/**
 * Membungkus teks sebagai string literal RouterOS. Aturan sama dengan `quote()`
 * di core (`internal/routeros/render.go`): `\`, `"`, `$`, `?` di-escape, dan
 * byte kontrol/non-ASCII menjadi `\HH` huruf besar.
 */
export function quoteRouterOs(value: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    const ch = String.fromCharCode(byte);
    if (ESCAPED_WITH_BACKSLASH.has(ch)) out += `\\${ch}`;
    else if (NAMED_ESCAPES[ch]) out += NAMED_ESCAPES[ch];
    else if (byte < ASCII_PRINTABLE_MIN || byte > ASCII_PRINTABLE_MAX) {
      out += `\\${byte.toString(HEX_RADIX).toUpperCase().padStart(2, "0")}`;
    } else out += ch;
  }
  return `"${out}"`;
}

// UNSURE (belum diuji di RouterOS v7 asli, menunggu spike): `:find` pada nilai
// `address` yang bisa berupa array atau string, dan penambahan elemen ke array.
function appendAddress(
  path: string,
  selector: string,
  cidr: string,
  variable: string,
): string[] {
  const entry = quoteRouterOs(cidr);
  return [
    `:if ([:len [${path} find ${selector}]] > 0) do={`,
    `  :local ${variable} [${path} get [find ${selector}] address]`,
    `  :if (([:len $${variable}] > 0) && ([:len [:find $${variable} ${entry}]] = 0)) do={`,
    `    :set ${variable} ($${variable}, ${entry})`,
    `    ${path} set [find ${selector}] address=$${variable}`,
    "  }",
    "}",
  ];
}

function createLines(input: VpnApiUserScriptInput, cidr: string): string[] {
  const group = quoteRouterOs(API_GROUP);
  const name = quoteRouterOs(input.username);
  const password = quoteRouterOs(input.password ?? "");
  const userFields = `group=${group} address=${cidr} password=${password}`;
  return [
    `:if ([:len [/user group find name=${group}]] = 0) do={ /user group add name=${group} policy=${API_GROUP_POLICY} } else={ /user group set [find name=${group}] policy=${API_GROUP_POLICY} }`,
    `:if ([:len [/user find name=${name}]] = 0) do={ /user add name=${name} ${userFields} } else={ /user set [find name=${name}] ${userFields} }`,
  ];
}

/**
 * Skrip RouterOS pelengkap skrip core: user API untuk netmanager dan akses
 * service API dari alamat core. Setiap baris create-or-update sehingga aman
 * ditempel ulang.
 */
export function buildVpnApiUserScript(input: VpnApiUserScriptInput): string {
  const cidr = `${input.coreAddress}/32`;
  const name = quoteRouterOs(input.username);
  const lines =
    input.mode === "create"
      ? createLines(input, cidr)
      : appendAddress("/user", `name=${name}`, cidr, "nmUserAddr");
  lines.push(
    `/ip service set [find name=api] disabled=no port=${API_SERVICE_PORT}`,
    ...appendAddress("/ip service", "name=api", cidr, "nmApiAddr"),
  );
  return `${lines.join("\n")}\n`;
}
