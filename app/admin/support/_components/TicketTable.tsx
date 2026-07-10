"use client";

import { formatDistanceToNow, format } from "date-fns";
import { id } from "date-fns/locale";
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChatBubbleLeftRight,
} from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  CATEGORY_LABELS,
} from "../[id]/_components/types";

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  rating?: number | null;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    noTelp: string | null;
    email: string | null;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  lastReply?: {
    isFromAdmin: boolean;
    createdAt: string;
    message?: string;
  } | null;
  replyCount: number;
}

const RATING_REGEX = /(⭐{1,5})/;

function extractRating(ticket: Ticket): number | null {
  if (ticket.status !== "CLOSED") return null;
  if (
    typeof ticket.rating === "number" &&
    ticket.rating >= 1 &&
    ticket.rating <= 5
  ) {
    return ticket.rating;
  }
  if (!ticket.lastReply?.message) return null;
  const match = RATING_REGEX.exec(ticket.lastReply.message);
  return match?.[1] ? match[1].length : null;
}

function renderStars(rating: number | null) {
  if (rating === null) {
    return <span className="text-gray-400 text-xs">-</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? "text-yellow-400" : "text-gray-300"}
        >
          {"★"}
        </span>
      ))}
    </div>
  );
}

interface TicketTableProps {
  tickets: Ticket[];
  isLoading: boolean;
  totalPages: number;
  total: number;
  page: number;
  onRowClick: (ticket: Ticket) => void;
  onPageChange: (page: number) => void;
}

export function TicketTable({
  tickets,
  isLoading,
  totalPages,
  total,
  page,
  onRowClick,
  onPageChange,
}: TicketTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <ResponsiveTable
        data={tickets}
        keyField="id"
        loading={isLoading}
        onRowClick={onRowClick}
        emptyMessage={
          <div className="text-center py-12">
            <HiOutlineChatBubbleLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Tidak ada tiket ditemukan</p>
          </div>
        }
        columns={[
          {
            key: "ticketNumber",
            header: "Tiket",
            priority: "primary",
            render: (ticket: Ticket) => (
              <div className="flex items-center gap-3">
                <div
                  className={`w-1.5 h-10 rounded-full ${PRIORITY_COLORS[ticket.priority] ?? "bg-gray-400"}`}
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {ticket.subject}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    #{ticket.ticketNumber}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "pelanggan",
            header: "Pelanggan",
            priority: "primary",
            render: (ticket: Ticket) => (
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {ticket.pelanggan.nama}
                </div>
                <div className="text-xs text-gray-500">
                  {ticket.pelanggan.idPelanggan}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            priority: "secondary",
            render: (ticket: Ticket) => (
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-700"}`}
              >
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>
            ),
          },
          {
            key: "category",
            header: "Kategori",
            priority: "secondary",
            render: (ticket: Ticket) => (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </span>
            ),
          },
          {
            key: "createdAt",
            header: "Dibuat",
            priority: "tertiary",
            render: (ticket: Ticket) => (
              <div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {format(new Date(ticket.createdAt), "dd MMM yyyy", {
                    locale: id,
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(ticket.createdAt), {
                    addSuffix: true,
                    locale: id,
                  })}
                </div>
              </div>
            ),
          },
          {
            key: "replyCount",
            header: "Balasan",
            priority: "tertiary",
            render: (ticket: Ticket) => (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {ticket.replyCount}
                </span>
                {ticket.lastReply &&
                  !ticket.lastReply.isFromAdmin &&
                  ticket.status !== "RESOLVED" &&
                  ticket.status !== "CLOSED" && (
                    <span
                      className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full animate-pulse"
                      title="Perlu balasan"
                    />
                  )}
              </div>
            ),
          },
          {
            key: "rating",
            header: "Rating",
            priority: "tertiary",
            render: (ticket: Ticket) => renderStars(extractRating(ticket)),
          },
        ]}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500">
            Halaman {page} dari {totalPages}
            {total > 0 ? ` · Total ${total} tiket` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <HiChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <HiChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
