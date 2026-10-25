import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import type { RouterRow } from "./mikrotik-provisioning.restore";

const PAGE_FILE = "webproxy/error.html";
const FILE_POLL_MS = 500;
const FILE_WAIT_MS = 5000;

type PageConnection = Pick<RouterOSAPI, "write">;

async function readPageFile(
  connection: PageConnection,
): Promise<RouterRow | undefined> {
  const rows = (await connection.write("/file/print", [
    `?name=${PAGE_FILE}`,
  ])) as RouterRow[];
  return rows[0];
}

async function resetProxyHtml(connection: PageConnection, logs: string[]) {
  await connection.write("/ip/proxy/reset-html");
  logs.push("Reset Web Proxy HTML pages");
}

// reset-html membuat folder webproxy secara asinkron, jadi file baru bisa
// dibaca beberapa saat setelah perintahnya selesai.
async function waitForPageFile(connection: PageConnection) {
  for (let waited = 0; waited <= FILE_WAIT_MS; waited += FILE_POLL_MS) {
    const file = await readPageFile(connection);
    if (file) {
      return file;
    }
    await delay(FILE_POLL_MS);
  }
  throw new Error(`${PAGE_FILE} tidak muncul setelah reset-html`);
}

/**
 * Tulis halaman isolir ke `webproxy/error.html`. Router yang belum punya
 * folder webproxy dibuatkan lewat reset-html, lalu isinya diganti dengan
 * `/file/set`, yang ada di RouterOS v6 maupun v7 (`/file/add` tidak ada di
 * v6). Isi yang sudah sama tidak ditulis ulang; RouterOS hanya mengirim
 * `contents` untuk file kecil, jadi tanpa itu file selalu ditulis.
 */
export async function writeIsolirPageFile(
  connection: PageConnection,
  html: string,
  logs: string[],
): Promise<void> {
  let file = await readPageFile(connection);
  if (!file) {
    await resetProxyHtml(connection, logs);
    file = await waitForPageFile(connection);
  }
  if (file.contents === html) {
    logs.push(`Isolir page ${PAGE_FILE} already up to date`);
    return;
  }

  await connection.write("/file/set", [
    `=.id=${file[".id"]}`,
    `=contents=${html}`,
  ]);
  logs.push(
    `Wrote isolir page ${PAGE_FILE} (${Buffer.byteLength(html)} bytes)`,
  );
}

/** Kembalikan halaman bawaan web proxy, menimpa halaman isolir buatan billing. */
export async function removeIsolirPageFile(
  connection: PageConnection,
  logs: string[],
): Promise<void> {
  await resetProxyHtml(connection, logs);
}
