"use client";

import { useCallback, useEffect, useState } from "react";

import { deleteWithAuth, getWithAuth, postWithAuth } from "@/lib/api-client";

import { resolveAbsoluteLinkUrl } from "./restockPurchaseLink";
import type {
  PurchaseLinkCreated,
  PurchaseLinkInfo,
  PurchaseLinkStatus,
} from "./types";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

/** Aksi yang sedang menunggu konfirmasi admin. */
export type PurchaseLinkConfirmation = "replace" | "revoke" | null;

const LOAD_FAILED_MESSAGE = "Info link belanja belum bisa dimuat.";
const CREATE_FAILED_MESSAGE = "Link belanja belum bisa dibuat. Coba lagi.";
const REVOKE_FAILED_MESSAGE = "Link belanja belum bisa dimatikan. Coba lagi.";

function buildLinkEndpoint(requestId: string): string {
  return `/api/inventory/restock/requests/${requestId}/purchase-link`;
}

/**
 * Status dan aksi link belanja satu pengajuan: muat status, buat link (yang
 * lama dicabut), dan matikan link. URL hanya disimpan di memori: setelah
 * panel ditutup, link tidak bisa ditampilkan lagi.
 */
export function useRestockPurchaseLink(requestId: string) {
  const [status, setStatus] = useState<PurchaseLinkStatus | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmation, setConfirmation] =
    useState<PurchaseLinkConfirmation>(null);

  /** Ambil status; semua setState terjadi sesudah request selesai. */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await getWithAuth(buildLinkEndpoint(requestId), {
        cache: "no-store",
      });
      if (!response.ok) {
        setErrorMessage(
          await readRestockErrorMessage(response, LOAD_FAILED_MESSAGE),
        );
        return;
      }
      const body = (await response.json()) as { data: PurchaseLinkStatus };
      setStatus(body.data);
    } catch (error: unknown) {
      setErrorMessage(describeRestockClientError(error));
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    // Semua setState di fetchStatus terjadi sesudah await (aturan ini tidak
    // membedakannya).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
  }, [fetchStatus]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    await fetchStatus();
  }, [fetchStatus]);

  const applyLink = useCallback((link: PurchaseLinkInfo | null) => {
    setStatus((current) => (current ? { ...current, link } : current));
  }, []);

  const create = useCallback(async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setConfirmation(null);
    try {
      const response = await postWithAuth(buildLinkEndpoint(requestId), {});
      if (!response.ok) {
        setErrorMessage(
          await readRestockErrorMessage(response, CREATE_FAILED_MESSAGE),
        );
        if (response.status === 409) await fetchStatus();
        return;
      }
      const body = (await response.json()) as { data: PurchaseLinkCreated };
      setCreatedUrl(resolveAbsoluteLinkUrl(body.data.url));
      applyLink(body.data.link);
    } catch (error: unknown) {
      setErrorMessage(describeRestockClientError(error));
    } finally {
      setIsBusy(false);
    }
  }, [applyLink, fetchStatus, requestId]);

  const revoke = useCallback(async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setConfirmation(null);
    try {
      const response = await deleteWithAuth(buildLinkEndpoint(requestId));
      if (!response.ok) {
        setErrorMessage(
          await readRestockErrorMessage(response, REVOKE_FAILED_MESSAGE),
        );
        return;
      }
      setCreatedUrl(null);
      applyLink(null);
    } catch (error: unknown) {
      setErrorMessage(describeRestockClientError(error));
    } finally {
      setIsBusy(false);
    }
  }, [applyLink, requestId]);

  return {
    status,
    createdUrl,
    errorMessage,
    isLoading,
    isBusy,
    confirmation,
    setConfirmation,
    reload,
    create,
    revoke,
  };
}

export type RestockPurchaseLinkState = ReturnType<
  typeof useRestockPurchaseLink
>;
