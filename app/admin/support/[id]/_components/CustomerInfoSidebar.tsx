"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import {
  HiOutlineUser,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineMapPin,
} from "react-icons/hi2";
import { MdAssignment } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { getCategoryLabel, getPriorityLabel, type TicketDetail } from "./types";

interface CustomerInfoSidebarProps {
  ticket: TicketDetail;
  status: string;
  sendingClosingMsg: boolean;
  onSendClosingMessage: () => void;
}

export function CustomerInfoSidebar({
  ticket,
  status,
  sendingClosingMsg,
  onSendClosingMessage,
}: CustomerInfoSidebarProps) {
  const router = useRouter();
  const priority = getPriorityLabel(ticket.priority);

  const handleCreateWorkOrder = () => {
    const draft = {
      ticketId: ticket.id,
      pelangganId: ticket.pelanggan.id,
      title: `[TIKET-${ticket.ticketNumber}] ${ticket.subject}`,
      description: ticket.description,
      priority: ticket.priority,
    };
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("workorder-draft", JSON.stringify(draft));
    }
    router.push(
      `/admin/workorders/new?ticketId=${encodeURIComponent(ticket.id)}`,
    );
  };

  return (
    <div className="w-full lg:w-80 bg-white dark:bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
      <div className="p-4 space-y-6">
        <CustomerInfoSection ticket={ticket} />
        <hr className="border-gray-100 dark:border-gray-800" />
        <TicketInfoSection ticket={ticket} priority={priority} />
        <hr className="border-gray-100 dark:border-gray-800" />
        <QuickActions
          ticket={ticket}
          status={status}
          sendingClosingMsg={sendingClosingMsg}
          onCreateWorkOrder={handleCreateWorkOrder}
          onSendClosingMessage={onSendClosingMessage}
        />
      </div>
    </div>
  );
}

function CustomerInfoSection({ ticket }: { ticket: TicketDetail }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Informasi Pelanggan
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <HiOutlineUser className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {ticket.pelanggan.nama}
            </p>
            <p className="text-xs text-gray-500">
              {ticket.pelanggan.idPelanggan}
            </p>
          </div>
        </div>
        {ticket.pelanggan.noTelp && (
          <div className="flex items-center gap-3">
            <HiOutlinePhone className="w-4 h-4 text-gray-400" />
            <a
              href={`tel:${encodeURIComponent(ticket.pelanggan.noTelp)}`}
              className="text-sm text-teal-600 hover:underline"
            >
              {ticket.pelanggan.noTelp}
            </a>
          </div>
        )}
        {ticket.pelanggan.email && (
          <div className="flex items-center gap-3">
            <HiOutlineEnvelope className="w-4 h-4 text-gray-400" />
            <a
              href={`mailto:${encodeURIComponent(ticket.pelanggan.email)}`}
              className="text-sm text-teal-600 hover:underline truncate"
            >
              {ticket.pelanggan.email}
            </a>
          </div>
        )}
        {ticket.pelanggan.alamat && (
          <div className="flex items-start gap-3">
            <HiOutlineMapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {ticket.pelanggan.alamat}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketInfoSection({
  ticket,
  priority,
}: {
  ticket: TicketDetail;
  priority: { label: string; color: string };
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Detail Tiket
      </h3>
      <div className="space-y-3">
        <InfoRow label="Prioritas">
          <span className={`text-sm font-medium ${priority.color}`}>
            {priority.label}
          </span>
        </InfoRow>
        <InfoRow label="Kategori">
          <span className="text-sm text-gray-900 dark:text-white">
            {getCategoryLabel(ticket.category)}
          </span>
        </InfoRow>
        <InfoRow label="Paket">
          <span className="text-sm text-gray-900 dark:text-white">
            {ticket.pelanggan.hargaPaket?.name || "-"}
          </span>
        </InfoRow>
        <InfoRow label="Dibuat">
          <span className="text-sm text-gray-900 dark:text-white">
            {formatDistanceToNow(new Date(ticket.createdAt), {
              addSuffix: true,
              locale: id,
            })}
          </span>
        </InfoRow>
        {ticket.assignedTo && (
          <InfoRow label="Ditugaskan">
            <span className="text-sm text-gray-900 dark:text-white">
              {ticket.assignedTo.name}
            </span>
          </InfoRow>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function QuickActions({
  ticket,
  status,
  sendingClosingMsg,
  onCreateWorkOrder,
  onSendClosingMessage,
}: {
  ticket: TicketDetail;
  status: string;
  sendingClosingMsg: boolean;
  onCreateWorkOrder: () => void;
  onSendClosingMessage: () => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Aksi Cepat
      </h3>
      <div className="space-y-2">
        <Link
          href={`/admin/pelanggan/ppp/${ticket.pelanggan.id}`}
          className="block w-full px-4 py-2 text-sm text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Lihat Profil Pelanggan
        </Link>
        <Button onClick={onCreateWorkOrder} className="w-full">
          <MdAssignment className="text-xl" />
          Buat Work Order
        </Button>
        {status !== "CLOSED" && (
          <Button
            onClick={onSendClosingMessage}
            disabled={sendingClosingMsg}
            className="block w-full px-4 py-2 text-sm text-center bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors border border-teal-200 dark:border-teal-800 disabled:opacity-50"
          >
            {sendingClosingMsg ? "Mengirim..." : "📩 Kirim Pesan Penutup"}
          </Button>
        )}
      </div>
    </div>
  );
}
