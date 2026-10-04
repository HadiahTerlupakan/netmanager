"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientLogger } from "@/lib/client-logger";
import { describeApiError } from "../../components/legal-format";
import { jsonRequest } from "../../components/legal-request";
import type { ApiEnvelope, TemplateBlock } from "../../components/legal-types";
import { TEMPLATE_PREVIEW_URL } from "../useLegalTemplates";
import { prepareTemplateContent } from "./template-blocks";

/**
 * PDF pratinjau template dari server, ditampilkan lewat object URL. URL lama
 * dicabut setiap kali diganti dan saat komponen dilepas; permintaan yang
 * tersusul permintaan baru dibatalkan.
 */

/** Data dokumen untuk mengisi {{kunci}} di pratinjau; semua opsional. */
export interface TemplatePreviewDocument {
  title?: string | null;
  documentNumber?: string | null;
  partyName?: string | null;
  partyType?: string | null;
  partyId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  value?: string | null;
}

const PREVIEW_FAILURE_MESSAGE = "Gagal membuat pratinjau";
const NETWORK_FAILURE_MESSAGE = "Terjadi kesalahan jaringan";

/** Status pratinjau PDF dan pemicu pembaruannya. */
export function useTemplatePreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const showPdf = useCallback((pdf: Blob) => {
    const nextUrl = URL.createObjectURL(pdf);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  /** Minta PDF baru untuk isi blok (dan data dokumen bila ada). */
  const refreshPreview = useCallback(
    async (blocks: TemplateBlock[], document?: TemplatePreviewDocument) => {
      const prepared = prepareTemplateContent(blocks);
      if (prepared.error !== null) {
        setError(prepared.error);
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(TEMPLATE_PREVIEW_URL, {
          ...jsonRequest("POST", { content: prepared.content, document }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
          setError(describeApiError(body, PREVIEW_FAILURE_MESSAGE));
          return;
        }
        showPdf(await response.blob());
      } catch (requestError) {
        if (controller.signal.aborted) return;
        clientLogger.error("[Legal] pratinjau template gagal:", requestError);
        setError(NETWORK_FAILURE_MESSAGE);
      } finally {
        if (requestRef.current === controller) setIsLoading(false);
      }
    },
    [showPdf],
  );

  return { previewUrl, isLoading, error, refreshPreview };
}
