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

/** Rute pembuat draft router baru. */
export const VPN_DRAFT_URL = "/api/mikrotik-routers/vpn-draft";
const NO_SERVER_SELECTED_MESSAGE = "Pilih minimal satu server VPN";

/** Permintaan draft: urutan server = prioritas; kredensial dikirim ulang agar password tetap. */
export type VpnDraftRequest = {
  serverIds: string[];
  protocol: "WIREGUARD" | "L2TP";
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
  /** Draft yang sudah dibuat halaman; bila ada, modal tidak membuat draft sendiri. */
  draft?: D;
  /** Tombol tambahan di samping "Tutup". */
  footerAction?: ReactNode;
};

/** Hanya kirim nilai yang ada; field kosong ditolak validasi rute draft. */
function buildDraftBody(request: VpnDraftRequest) {
  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => Boolean(value)),
  );
}

/** Hasil satu permintaan draft: draft yang dibuat, atau pesan galat untuk operator. */
export type VpnDraftResult<D> = { draft: D } | { error: string };

/** Mengirim satu permintaan draft VPN; galat jaringan dicatat tanpa isi permintaan. */
export async function postVpnDraft<D extends VpnScriptDraft>(
  draftUrl: string,
  request: VpnDraftRequest,
): Promise<VpnDraftResult<D>> {
  try {
    const res = await fetch(draftUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDraftBody(request)),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || "Gagal membuat script VPN" };
    return { draft: body.data ?? body };
  } catch (err) {
    clientLogger.error("Error membuat draft VPN:", err);
    return { error: "Terjadi kesalahan sistem" };
  }
}

/**
 * Membuat draft sekali per pemasangan modal; dipasang ulang tiap kali dibuka.
 * Draft dari halaman (`supplied`) dipakai apa adanya tanpa POST.
 */
function useVpnDraft<D extends VpnScriptDraft>(
  draftUrl: string,
  request: VpnDraftRequest,
  onDraftReady: (draft: D) => void,
  supplied: D | undefined,
) {
  const [created, setCreated] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(
    !supplied && request.serverIds.length === 0
      ? NO_SERVER_SELECTED_MESSAGE
      : null,
  );
  const initialRequest = useRef(request);
  const initialUrl = useRef(draftUrl);
  const onReady = useRef(onDraftReady);
  const hasSupplied = useRef(Boolean(supplied));

  useEffect(() => {
    if (hasSupplied.current) return;
    if (initialRequest.current.serverIds.length === 0) return;
    let isCancelled = false;
    const createDraft = async () => {
      const result = await postVpnDraft<D>(
        initialUrl.current,
        initialRequest.current,
      );
      if (isCancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCreated(result.draft);
      onReady.current(result.draft);
    };
    void createDraft();
    return () => {
      isCancelled = true;
    };
  }, []);

  return { draft: supplied ?? created, error };
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
 * Modal script VPN: membuat draft saat dibuka (kecuali `draft` diberikan), menampilkan script tempel,
 * memantau tunnel, lalu meminta test koneksi sekali begitu tunnel hidup.
 */
export default function VpnScriptModal<D extends VpnScriptDraft = VpnDraft>({
  request,
  apiCheck,
  onClose,
  onDraftReady,
  onTunnelUp,
  draftUrl = VPN_DRAFT_URL,
  footerAction,
  draft: suppliedDraft,
}: VpnScriptModalProps<D>) {
  const { draft, error } = useVpnDraft(
    draftUrl,
    request,
    onDraftReady,
    suppliedDraft,
  );
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
