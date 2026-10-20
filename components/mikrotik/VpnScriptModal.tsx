"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clientLogger } from "@/lib/client-logger";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import VpnCommandBox from "@/app/admin/tenants/vpn/VpnCommandBox";
import { useVpnDraftStatus } from "@/app/admin/network/mikrotik/hooks/useVpnDraftStatus";
import type {
  VpnApiCheck,
  VpnDraft,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const DRAFT_URL = "/api/mikrotik-routers/vpn-draft";
const NO_SERVER_SELECTED_MESSAGE = "Pilih minimal satu server VPN";

/** Permintaan draft: urutan server = prioritas; kredensial dikirim ulang agar password tetap. */
export type VpnDraftRequest = {
  serverIds: string[];
  previousDraftId?: string;
  apiUsername?: string;
  apiPassword?: string;
};

/** Status test API: `testing` selama test otomatis berjalan, null bila belum. */
export type VpnApiCheckState = VpnApiCheck | { status: "testing" } | null;

/** Bagian draft yang dipakai modal; rute draft bisa mengembalikan lebih banyak. */
export type VpnScriptDraft = Pick<VpnDraft, "draftId" | "address" | "script">;

type VpnScriptModalProps<D extends VpnScriptDraft> = {
  request: VpnDraftRequest;
  apiCheck: VpnApiCheckState;
  onClose: () => void;
  onDraftReady: (draft: D) => void;
  onTunnelUp: () => void;
  /** Rute pembuat draft; bawaan rute draft router baru. */
  draftUrl?: string;
  /** Tombol tambahan di samping "Tutup". */
  footerAction?: ReactNode;
};

/** Hanya kirim nilai yang ada; field kosong ditolak validasi rute draft. */
function buildDraftBody(request: VpnDraftRequest) {
  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => Boolean(value)),
  );
}

/** Membuat draft sekali per pemasangan modal; dipasang ulang tiap kali dibuka. */
function useVpnDraft<D extends VpnScriptDraft>(
  draftUrl: string,
  request: VpnDraftRequest,
  onDraftReady: (draft: D) => void,
) {
  const [draft, setDraft] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(
    request.serverIds.length === 0 ? NO_SERVER_SELECTED_MESSAGE : null,
  );
  const initialRequest = useRef(request);
  const initialUrl = useRef(draftUrl);
  const onReady = useRef(onDraftReady);

  useEffect(() => {
    if (initialRequest.current.serverIds.length === 0) return;
    let isCancelled = false;
    const createDraft = async () => {
      try {
        const res = await fetch(initialUrl.current, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDraftBody(initialRequest.current)),
        });
        const body = await res.json();
        if (isCancelled) return;
        if (!res.ok) {
          setError(body.error || "Gagal membuat script VPN");
          return;
        }
        const created: D = body.data ?? body;
        setDraft(created);
        onReady.current(created);
      } catch (err) {
        clientLogger.error("Error membuat draft VPN:", err);
        if (!isCancelled) setError("Terjadi kesalahan sistem");
      }
    };
    void createDraft();
    return () => {
      isCancelled = true;
    };
  }, []);

  return { draft, error };
}

function StatusLine({ isDone, text }: { isDone: boolean; text: string }) {
  return (
    <p
      className={`text-sm font-medium ${isDone ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
    >
      {text}
    </p>
  );
}

function ApiCheckLine({ apiCheck }: { apiCheck: VpnApiCheckState }) {
  if (!apiCheck) return null;
  if (apiCheck.status === "testing") {
    return <StatusLine isDone={false} text="Menguji koneksi API..." />;
  }
  if (apiCheck.status === "passed") {
    return <StatusLine isDone text={apiCheck.message} />;
  }
  return (
    <p className="text-sm font-medium text-red-600 dark:text-red-400">
      {apiCheck.message}
    </p>
  );
}

/**
 * Modal script VPN: membuat draft saat dibuka, menampilkan script tempel,
 * memantau tunnel, lalu meminta test koneksi sekali begitu tunnel hidup.
 */
export default function VpnScriptModal<D extends VpnScriptDraft = VpnDraft>({
  request,
  apiCheck,
  onClose,
  onDraftReady,
  onTunnelUp,
  draftUrl = DRAFT_URL,
  footerAction,
}: VpnScriptModalProps<D>) {
  const { draft, error } = useVpnDraft(draftUrl, request, onDraftReady);
  const { stage, isHintVisible } = useVpnDraftStatus(draft?.draftId ?? null);
  const isTunnelUp = stage === "tunnel_up";
  const hasReportedTunnel = useRef(false);
  const latestOnTunnelUp = useRef(onTunnelUp);

  useEffect(() => {
    latestOnTunnelUp.current = onTunnelUp;
  });

  useEffect(() => {
    if (!isTunnelUp || hasReportedTunnel.current) return;
    hasReportedTunnel.current = true;
    latestOnTunnelUp.current();
  }, [isTunnelUp]);

  return (
    <Modal isOpen onClose={onClose} title="Script VPN MikroTik" size="2xl">
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!draft && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Membuat script...
          </p>
        )}
        {draft && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tempel script ini di terminal MikroTik (RouterOS v7).
            </p>
            <VpnCommandBox command={draft.script} />
            <StatusLine
              isDone={isTunnelUp}
              text={
                isTunnelUp ? "Tunnel tersambung" : "Menunggu script ditempel"
              }
            />
            {isHintVisible && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Pastikan RouterOS v7 dan VPS bisa dijangkau dari router.
              </p>
            )}
            <ApiCheckLine apiCheck={apiCheck} />
          </>
        )}
        <ModalFooter>
          {footerAction}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Tutup
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
