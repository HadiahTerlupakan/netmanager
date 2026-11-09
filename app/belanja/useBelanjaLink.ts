"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { BELANJA_TEXTS } from "./belanja-texts";
import type { BelanjaList, BelanjaSubmitInput } from "./belanjaForm";
import { captureLinkToken, subscribeToLinkToken } from "./belanjaLinkToken";

/**
 * Hubungan halaman daftar belanja dengan server: membaca token dari fragmen
 * URL (lalu fragmennya dihapus, lihat `belanjaLinkToken`), memuat daftar,
 * dan mengirim catatan belanja.
 *
 * Token hanya dibawa di body JSON, tidak pernah di URL request, log, atau
 * localStorage (hanya sessionStorage tab ini). `clientRequestId` dibuat sekali per isian dan dipakai ulang
 * saat kiriman diulang, supaya kiriman dobel tidak tercatat dua kali. Server
 * membandingkan isi kiriman ulang: bila berbeda dari yang sudah tersimpan,
 * jawabannya 409 dan penanda diganti, bukan "tersimpan" yang menyesatkan.
 */

export type BelanjaStatus =
  | "loading"
  | "inactive"
  | "error"
  | "allPurchased"
  | "form";

/** Hasil kiriman; `list` adalah daftar terbaru bila berhasil dimuat ulang. */
export type BelanjaSubmitResult =
  | { ok: true; message: string; list: BelanjaList | null }
  | { ok: false; message: string };

const BUYER_NAME_STORAGE_KEY = "belanja:namaPembeli";
const LIST_ENDPOINT = "/api/belanja/daftar";
const RECORD_ENDPOINT = "/api/belanja/catat";
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const UUID_BYTES = 16;

interface JsonResponse {
  status: number;
  body: unknown;
}

/** Nama pembeli yang diingat di perangkat ini; "" bila tidak ada/terblokir. */
export function readStoredBuyerName(): string {
  try {
    return window.localStorage.getItem(BUYER_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Ingat nama pembeli untuk kunjungan berikutnya; diam bila terblokir. */
export function storeBuyerName(name: string): void {
  try {
    window.localStorage.setItem(BUYER_NAME_STORAGE_KEY, name);
  } catch {
    // Mode pribadi atau penyimpanan diblokir: nama cukup tidak diingat.
  }
}

/** UUID v4; memakai getRandomValues bila randomUUID tidak tersedia (http). */
export function createClientRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Saat render di server token belum diketahui. */
const readServerToken = (): string | null => null;

async function postJson(path: string, body: unknown): Promise<JsonResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const parsed: unknown = await response.json().catch((): null => null);
  return { status: response.status, body: parsed };
}

function readServerError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body as { error?: unknown };
    if (typeof error === "string" && error) return error;
  }
  return fallback;
}

function readData<T>(body: unknown): T | null {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return null;
}

/** Daftar belanja, status halaman, dan pengiriman catatan belanja. */
export function useBelanjaLink() {
  // null = belum di peramban, "" = tidak ada token yang sah.
  const capturedToken = useSyncExternalStore(
    subscribeToLinkToken,
    captureLinkToken,
    readServerToken,
  );
  const token = capturedToken || null;
  const clientRequestIdRef = useRef<string | null>(null);
  const [fetchedStatus, setFetchedStatus] = useState<BelanjaStatus>("loading");
  const [list, setList] = useState<BelanjaList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (linkToken: string): Promise<BelanjaList | null> => {
      try {
        const response = await postJson(LIST_ENDPOINT, { token: linkToken });
        if (response.status === HTTP_NOT_FOUND) {
          setFetchedStatus("inactive");
          return null;
        }
        const data = readData<BelanjaList>(response.body);
        if (response.status !== 200 || !data) {
          setLoadError(
            readServerError(response.body, BELANJA_TEXTS.serverError),
          );
          setFetchedStatus("error");
          return null;
        }
        setList(data);
        setLoadError(null);
        setFetchedStatus(
          data.state === "ALL_PURCHASED" ? "allPurchased" : "form",
        );
        return data;
      } catch {
        setLoadError(BELANJA_TEXTS.offlineLoad);
        setFetchedStatus("error");
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    // Semua setState di load terjadi sesudah await (aturan ini tidak
    // membedakannya).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) void load(token);
  }, [load, token]);

  const retry = useCallback(() => {
    if (!token) return;
    setFetchedStatus("loading");
    void load(token);
  }, [load, token]);

  const submit = useCallback(
    async (input: BelanjaSubmitInput): Promise<BelanjaSubmitResult> => {
      if (!token) return { ok: false, message: BELANJA_TEXTS.inactiveTitle };
      clientRequestIdRef.current ??= createClientRequestId();
      let response: JsonResponse;
      try {
        response = await postJson(RECORD_ENDPOINT, {
          ...input,
          token,
          clientRequestId: clientRequestIdRef.current,
        });
      } catch {
        return { ok: false, message: BELANJA_TEXTS.offline };
      }

      if (response.status === HTTP_NOT_FOUND) {
        setFetchedStatus("inactive");
        return {
          ok: false,
          message: readServerError(response.body, BELANJA_TEXTS.inactiveTitle),
        };
      }
      if (response.status !== 200 && response.status !== 201) {
        const message = readServerError(
          response.body,
          BELANJA_TEXTS.serverError,
        );
        if (response.status === HTTP_CONFLICT) {
          // 409 berarti kiriman ini tidak dicatat (daftar berubah) atau
          // kiriman sebelumnya dengan isi berbeda sudah tersimpan. Simpan
          // berikutnya adalah belanja baru, jadi butuh penanda baru.
          clientRequestIdRef.current = null;
          await load(token);
        }
        return { ok: false, message };
      }
      clientRequestIdRef.current = null;
      const data = readData<{ message?: string; state?: string }>(
        response.body,
      );
      if (data?.state === "ALL_PURCHASED") {
        // Semua sudah dibeli: server langsung mematikan link, jadi daftar
        // tidak dimuat ulang (jawabannya pasti "tidak berlaku").
        setFetchedStatus("allPurchased");
        return { ok: true, message: data.message ?? "", list: null };
      }
      const refreshed = await load(token);
      return { ok: true, message: data?.message ?? "", list: refreshed };
    },
    [load, token],
  );

  /** Tanpa token atau fragmen salah bentuk: tidak berlaku, tanpa request. */
  const status: BelanjaStatus =
    capturedToken === "" ? "inactive" : fetchedStatus;

  return { status, list, loadError, retry, submit };
}
