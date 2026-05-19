"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

import { useApi } from "@/lib/hooks/useApi";
import { useRealtimeTicketChat } from "@/lib/websocket/hooks/useRealtimeTicketChat";
import { clientLogger } from "@/lib/client-logger";

import { TicketHeader } from "./_components/TicketHeader";
import { MessagesList } from "./_components/MessagesList";
import { ReplyComposer } from "./_components/ReplyComposer";
import { CustomerInfoSidebar } from "./_components/CustomerInfoSidebar";
import { CloseTicketModal } from "./_components/CloseTicketModal";
import { useTicketActions } from "./_components/useTicketActions";
import type { TicketDetail } from "./_components/types";

type TicketResponse = TicketDetail | { ticket?: TicketDetail };

function unwrapTicket(
  response: TicketResponse | undefined,
): TicketDetail | null {
  if (!response) return null;
  if ("ticket" in response && response.ticket) return response.ticket;
  return response as TicketDetail;
}

export function SupportDetailClient() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  // Re-render via key={ticketId} dari Page memastikan state reset saat
  // navigasi antar tiket — tidak butuh effect untuk reset.
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const {
    data: ticketResponse,
    isLoading,
    error: ticketError,
    mutate: refetchTicket,
  } = useApi<TicketResponse>(`/api/admin/support-tickets/${ticketId}`);

  useEffect(() => {
    if (ticketError) {
      clientLogger.error("Error loading ticket:", ticketError);
    }
  }, [ticketError]);

  const ticket = unwrapTicket(ticketResponse);
  const status = statusOverride ?? ticket?.status ?? "";

  // Real-time chat via WebSocket — initial replies dari ticket detail
  const { replies, isConnected, addReply } = useRealtimeTicketChat({
    ticketId,
    initialReplies: ticket?.replies ?? [],
  });

  const actions = useTicketActions({
    ticketId,
    pelangganNama: ticket?.pelanggan.nama ?? "",
    refetchTicket: async () => {
      await refetchTicket();
    },
    addReply,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Tiket tidak ditemukan</p>
        <Link
          href="/admin/support"
          className="text-teal-600 hover:underline mt-2 inline-block"
        >
          Kembali ke daftar tiket
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    const ok = await actions.changeStatus(newStatus);
    if (ok) setStatusOverride(newStatus);
  };

  const handleConfirmClose = async (resolution: string) => {
    const ok = await actions.closeTicket(resolution);
    if (ok) {
      setStatusOverride("CLOSED");
      setShowCloseModal(false);
    }
  };

  const handleSendReply = async (input: {
    message: string;
    attachments: string[];
  }) => {
    const result = await actions.sendReply({
      message: input.message,
      attachments: input.attachments,
      currentStatus: status,
    });
    return result.ok;
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 flex flex-col min-w-0">
        <TicketHeader
          ticket={ticket}
          status={status}
          isConnected={isConnected}
          onBack={() => router.push("/admin/support")}
          onStatusChange={handleStatusChange}
          onCloseClick={() => setShowCloseModal(true)}
        />

        <MessagesList ticket={ticket} replies={replies} />

        {ticket.status !== "CLOSED" && (
          <ReplyComposer sending={actions.sending} onSend={handleSendReply} />
        )}
      </div>

      <CustomerInfoSidebar
        ticket={ticket}
        status={status}
        sendingClosingMsg={actions.sendingClosingMsg}
        onSendClosingMessage={() => actions.sendClosingMessage(ticket)}
      />

      <CloseTicketModal
        open={showCloseModal}
        closing={actions.closing}
        onCancel={() => setShowCloseModal(false)}
        onConfirm={handleConfirmClose}
      />
    </div>
  );
}
