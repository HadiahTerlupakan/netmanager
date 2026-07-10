"use client";

import { HiArrowLeft, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import {
  TICKET_STATUS_OPTIONS,
  getStatusBorderColor,
  type TicketDetail,
} from "./types";

interface TicketHeaderProps {
  ticket: TicketDetail;
  status: string;
  isConnected: boolean;
  onBack: () => void;
  onStatusChange: (newStatus: string) => void;
  onCloseClick: () => void;
}

export function TicketHeader({
  ticket,
  status,
  isConnected,
  onBack,
  onStatusChange,
  onCloseClick,
}: TicketHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <HiArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {ticket.subject}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 font-mono">
              #{ticket.ticketNumber}
            </p>
            {isConnected && (
              <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded animate-pulse">
                Live
              </span>
            )}
          </div>
        </div>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${getStatusBorderColor(status)} focus:outline-none focus:ring-2 focus:ring-teal-500`}
        >
          {TICKET_STATUS_OPTIONS.filter((opt) => opt.value !== "CLOSED").map(
            (opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ),
          )}
        </select>
        {status !== "CLOSED" && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCloseClick}
            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            title="Tutup Tiket"
          >
            <HiXMark className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
