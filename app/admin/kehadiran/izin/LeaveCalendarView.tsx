"use client";

import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";
import type { LeaveCalendarEvent } from "./types";
import {
  detectLeaveConflicts,
  getLeaveStatusColor,
  formatDateRange,
  getLeaveTypeLabel,
} from "./utils";

const locales = {
  id: idLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type LeaveCalendarViewProps = {
  events: LeaveCalendarEvent[];
  onSelectEvent?: (event: LeaveCalendarEvent) => void;
};

export function LeaveCalendarView({
  events,
  onSelectEvent,
}: LeaveCalendarViewProps) {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());

  const conflicts = useMemo(() => detectLeaveConflicts(events), [events]);

  const eventsWithConflicts = useMemo(() => {
    const conflictIds = new Set(
      conflicts.flatMap((c) => [c.leaveId, ...c.conflictingLeaveIds]),
    );

    return events.map((event) => ({
      ...event,
      resource: {
        ...event.resource,
        hasConflict: conflictIds.has(event.id),
      },
    }));
  }, [events, conflicts]);

  const eventStyleGetter = (event: LeaveCalendarEvent) => {
    const baseColor = getLeaveStatusColor(event.resource.status);
    const hasConflict = event.resource.hasConflict;

    return {
      style: {
        backgroundColor: baseColor,
        borderColor: hasConflict ? "#dc2626" : baseColor,
        borderWidth: hasConflict ? "3px" : "1px",
        borderStyle: "solid",
        color: "#ffffff",
        borderRadius: "4px",
        opacity: event.resource.status === "REJECTED" ? 0.6 : 1,
      },
    };
  };

  const handleSelectEvent = (event: LeaveCalendarEvent) => {
    if (onSelectEvent) {
      onSelectEvent(event);
    }
  };

  return (
    <div className="space-y-4">
      {conflicts.length > 0 && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Terdeteksi {conflicts.length} Konflik Izin
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {conflicts.slice(0, 3).map((conflict) => (
                    <li key={conflict.leaveId}>
                      {conflict.userName} memiliki izin yang overlap pada{" "}
                      {formatDateRange(
                        conflict.dateRange.start,
                        conflict.dateRange.end,
                      )}
                    </li>
                  ))}
                  {conflicts.length > 3 && (
                    <li>Dan {conflicts.length - 3} konflik lainnya...</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#10b981" }}
              />
              <span className="text-sm text-gray-600">Disetujui</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#f59e0b" }}
              />
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#ef4444" }}
              />
              <span className="text-sm text-gray-600">Ditolak</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-4 border-red-600" />
              <span className="text-sm text-gray-600">Konflik</span>
            </div>
          </div>
        </div>

        <Calendar
          localizer={localizer}
          events={eventsWithConflicts}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          culture="id"
          messages={{
            next: "Berikutnya",
            previous: "Sebelumnya",
            today: "Hari Ini",
            month: "Bulan",
            week: "Minggu",
            day: "Hari",
            agenda: "Agenda",
            date: "Tanggal",
            time: "Waktu",
            event: "Izin",
            noEventsInRange: "Tidak ada izin dalam rentang ini",
            showMore: (total) => `+${total} lainnya`,
          }}
          tooltipAccessor={(event) => {
            const { userName, type, status, reason } = event.resource;
            const dateRange = formatDateRange(event.start, event.end);
            let tooltip = `${userName}\n${getLeaveTypeLabel(type)}\n${dateRange}\nStatus: ${status}`;
            if (reason) {
              tooltip += `\nAlasan: ${reason}`;
            }
            if (event.resource.hasConflict) {
              tooltip += "\n⚠️ KONFLIK TERDETEKSI";
            }
            return tooltip;
          }}
        />
      </div>
    </div>
  );
}
