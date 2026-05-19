"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import { clientLogger } from "@/lib/client-logger";
import type { Reply, TicketDetail } from "./types";

const RESOLVED_STATUS = "RESOLVED";
const CLOSED_STATUS = "CLOSED";

interface UseTicketActionsArgs {
  ticketId: string;
  pelangganNama: string;
  refetchTicket: () => Promise<unknown>;
  addReply: (reply: Reply) => void;
}

interface SendReplyArgs {
  message: string;
  attachments: string[];
  currentStatus: string;
}

interface ReplyResponse {
  reply?: Reply;
}

interface UseTicketActionsResult {
  sendReply: (args: SendReplyArgs) => Promise<{ ok: boolean; reply?: Reply }>;
  changeStatus: (newStatus: string) => Promise<boolean>;
  closeTicket: (resolution: string) => Promise<boolean>;
  sendClosingMessage: (ticket: TicketDetail) => Promise<boolean>;
  sending: boolean;
  closing: boolean;
  sendingClosingMsg: boolean;
}

/**
 * Hook ringkas untuk mutasi tiket support: kirim balasan, ganti status,
 * tutup tiket dengan resolution, dan kirim pesan penutup template.
 * Unwrap envelope `{ success, data }` via `fetchWithHandling`.
 */
export function useTicketActions({
  ticketId,
  pelangganNama,
  refetchTicket,
  addReply,
}: UseTicketActionsArgs): UseTicketActionsResult {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sendingClosingMsg, setSendingClosingMsg] = useState(false);

  const sendReply = async (
    args: SendReplyArgs,
  ): Promise<{ ok: boolean; reply?: Reply }> => {
    setSending(true);
    try {
      const res = await fetchWithHandling<ReplyResponse>(
        `/api/admin/support-tickets/${ticketId}/reply`,
        {
          method: "POST",
          body: JSON.stringify({
            message: args.message,
            updateStatus:
              args.currentStatus === "OPEN" ? "IN_PROGRESS" : undefined,
            attachments:
              args.attachments.length > 0 ? args.attachments : undefined,
          }),
        },
      );

      if (!res.success || !res.data?.reply) {
        showToast("error", res.error || "Gagal mengirim balasan");
        return { ok: false };
      }

      const reply: Reply = {
        ...res.data.reply,
        attachments: args.attachments.length > 0 ? args.attachments : null,
      };
      addReply(reply);
      return { ok: true, reply };
    } catch (error) {
      clientLogger.error("Error sending reply:", error);
      const message =
        error instanceof Error ? error.message : "Gagal mengirim balasan";
      showToast("error", message);
      return { ok: false };
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (newStatus: string): Promise<boolean> => {
    try {
      const res = await fetchWithHandling(
        `/api/admin/support-tickets/${ticketId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.success) {
        showToast("error", res.error || "Gagal memperbarui status");
        return false;
      }

      await refetchTicket();
      return true;
    } catch (error) {
      clientLogger.error("Error updating status:", error);
      const message =
        error instanceof Error ? error.message : "Gagal memperbarui status";
      showToast("error", message);
      return false;
    }
  };

  const closeTicket = async (resolution: string): Promise<boolean> => {
    setClosing(true);
    try {
      const res = await fetchWithHandling(
        `/api/admin/support-tickets/${ticketId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: CLOSED_STATUS,
            resolution: resolution.trim() || undefined,
          }),
        },
      );

      if (!res.success) {
        showToast("error", res.error || "Gagal menutup tiket");
        return false;
      }

      showToast("success", "Tiket berhasil ditutup");
      await refetchTicket();
      return true;
    } catch (error) {
      clientLogger.error("Error closing ticket:", error);
      const message =
        error instanceof Error ? error.message : "Gagal menutup tiket";
      showToast("error", message);
      return false;
    } finally {
      setClosing(false);
    }
  };

  const sendClosingMessage = async (ticket: TicketDetail): Promise<boolean> => {
    setSendingClosingMsg(true);
    try {
      const closingMessage = buildClosingMessage(pelangganNama);
      const res = await fetchWithHandling<ReplyResponse>(
        `/api/admin/support-tickets/${ticketId}/reply`,
        {
          method: "POST",
          body: JSON.stringify({ message: closingMessage }),
        },
      );

      if (!res.success) {
        showToast("error", res.error || "Gagal mengirim pesan penutup");
        return false;
      }

      // Set status RESOLVED dan refresh data tiket
      await changeStatus(RESOLVED_STATUS);
      void ticket; // ticket arg dipertahankan untuk masa depan (mis. WA template)
      return true;
    } catch (error) {
      clientLogger.error("Error sending closing message:", error);
      const message =
        error instanceof Error ? error.message : "Gagal mengirim pesan penutup";
      showToast("error", message);
      return false;
    } finally {
      setSendingClosingMsg(false);
    }
  };

  return {
    sendReply,
    changeStatus,
    closeTicket,
    sendClosingMessage,
    sending,
    closing,
    sendingClosingMsg,
  };
}

function buildClosingMessage(pelangganNama: string) {
  return `Hai ${pelangganNama} 👋\n\nTerima kasih telah menghubungi kami. Jika masalah Anda sudah teratasi dan tidak ada kendala lagi, silakan tutup tiket ini dengan menekan tombol "Tutup Tiket" di halaman detail tiket.\n\nJika masih ada kendala, silakan balas pesan ini. Kami siap membantu! 🙏`;
}
