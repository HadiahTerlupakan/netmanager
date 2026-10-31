import { createHash, randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const REFRESH_CHAIN_KEY_PREFIX = "pelanggan:sesi-refresh:";

/**
 * Dua tab portal yang sama-sama memegang access token kedaluwarsa, atau
 * aplikasi yang mengulang request refresh setelah koneksi putus, menukar
 * refresh token yang sama hampir bersamaan. Selama jendela ini token yang
 * baru saja diputar masih diterima supaya mereka tidak dianggap pencuri.
 */
export const PELANGGAN_REFRESH_GRACE_MS = 30_000;

/**
 * Pengganti `jti` untuk refresh token yang terbit sebelum rotasi ini ada.
 * Token seperti itu diterima sekali lalu dipindah ke rantai baru, sama seperti
 * token biasa yang diputar.
 */
const LEGACY_JTI = "sebelum-rotasi";

/** `jti` refresh token berikutnya beserta catatan putarannya. */
export interface PelangganRefreshRotation {
  jti: string;
  previousJti?: string;
  rotatedAt?: number;
}

interface RefreshChainRecord {
  current: string;
  previous?: string;
  rotatedAt?: number;
}

function buildChainKey(sessionId: string) {
  return `${REFRESH_CHAIN_KEY_PREFIX}${sessionId}`;
}

/**
 * `jti` berikutnya diturunkan dari `jti` yang ditukar, bukan diacak. Dua
 * refresh serentak dengan token yang sama membaca catatan yang sama sebelum
 * salah satunya menulis; dengan turunan tetap keduanya menghasilkan `jti`
 * yang sama, jadi token mana pun yang akhirnya disimpan klien tetap yang
 * terbaru. Tanpa ini tulisan terakhir menang dan tab yang kalah dianggap
 * pencuri pada refresh berikutnya. `jti` bukan rahasia: memalsukan token tetap
 * butuh kunci JWT.
 */
function deriveNextJti(sessionId: string, jti: string) {
  return createHash("sha256").update(`${sessionId}:${jti}`).digest("base64url");
}

/** `jti` pertama untuk sesi login baru. */
export function startPelangganRefreshChain(): PelangganRefreshRotation {
  return { jti: randomUUID() };
}

/**
 * Id sesi untuk refresh token lama yang terbit sebelum ada `sid`, diturunkan
 * dari token itu sendiri: tanpa id tetap, setiap pemakaian ulangnya membuka
 * sesi baru dan tidak pernah tertangkap sebagai pemakaian ulang.
 */
export function deriveLegacyPelangganSessionId(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("base64url");
}

/**
 * Putaran berikutnya untuk refresh token sesi ini, atau null bila `jti`-nya
 * sudah pernah ditukar di luar masa tenggang — tanda token itu dipakai dua
 * pihak, sehingga pemanggil harus mengakhiri sesinya.
 *
 * Token lama yang ditukar lagi di dalam masa tenggang menerima `jti` terbaru
 * yang sudah tercatat, tanpa memutar ulang dan tanpa memundurkan waktu putar:
 * memutar lagi akan membuat token tab pertama tertinggal, dan memperbarui
 * waktunya akan membuat token lama hidup terus selama terus dipakai ulang.
 */
export async function resolvePelangganRefreshRotation(
  sessionId: string,
  presentedJti: string | undefined,
): Promise<PelangganRefreshRotation | null> {
  const presented = presentedJti ?? LEGACY_JTI;
  const rotateFromPresented = {
    jti: deriveNextJti(sessionId, presented),
    previousJti: presented,
    rotatedAt: Date.now(),
  };

  const record = await readChain(sessionId);
  if (!record || presented === record.current) return rotateFromPresented;
  if (isInsideGraceWindow(record, presented)) {
    return {
      jti: record.current,
      previousJti: presented,
      rotatedAt: record.rotatedAt,
    };
  }
  // Penerus sah dari `jti` terbaru: token ini terbit, tetapi catatannya gagal
  // ditulis. Menolaknya akan mengeluarkan pelanggan karena Redis sempat gagal.
  if (presented === deriveNextJti(sessionId, record.current)) {
    return rotateFromPresented;
  }
  return null;
}

function isInsideGraceWindow(record: RefreshChainRecord, presented: string) {
  return (
    record.previous === presented &&
    typeof record.rotatedAt === "number" &&
    Date.now() - record.rotatedAt <= PELANGGAN_REFRESH_GRACE_MS
  );
}

/**
 * Catatan rantai sesi, atau null bila tidak ada atau tidak terbaca. Keduanya
 * berarti refresh diterima: catatan tidak ada untuk sesi yang login sebelum
 * rotasi ini dan untuk catatan yang hilang dari Redis; menolak saat Redis
 * tidak terbaca berarti mengeluarkan SEMUA pelanggan selama gangguan, sama
 * seperti alasan `isPelangganSessionRevoked`. Ganti password tetap mencabut
 * semua sesi lewat `tokenVersion` di basis data.
 */
async function readChain(sessionId: string) {
  try {
    const stored = await redis.get(buildChainKey(sessionId));
    return stored ? (JSON.parse(stored) as RefreshChainRecord) : null;
  } catch (error) {
    logger.warn(
      "[PelangganSession] Rantai refresh token tidak terbaca; refresh tetap diizinkan",
      error,
    );
    return null;
  }
}

/**
 * Catat `jti` putaran ini sebagai yang terbaru untuk sesinya. Tidak melempar:
 * token baru tetap sah walau catatannya gagal ditulis, karena penerus dari
 * `jti` terbaru dikenali dari turunannya.
 */
export async function storePelangganRefreshRotation(
  sessionId: string,
  rotation: PelangganRefreshRotation,
  ttlSeconds: number,
): Promise<void> {
  const record: RefreshChainRecord = {
    current: rotation.jti,
    previous: rotation.previousJti,
    rotatedAt: rotation.rotatedAt,
  };
  try {
    await redis.setex(
      buildChainKey(sessionId),
      ttlSeconds,
      JSON.stringify(record),
    );
  } catch (error) {
    logger.warn(
      "[PelangganSession] Gagal mencatat refresh token terbaru; token tetap diterbitkan",
      error,
    );
  }
}
