import { NextResponse } from "next/server";
import { isHistoricalAutoCheckoutAbsence } from "@/lib/attendance-display";
import {
  buildAttendanceEvaluationKey,
  getAttendanceDisplayStatus,
  getEffectiveAttendanceStatus,
} from "./AdminAttendanceEvaluationHelper";
import type {
  AdminAttendanceRow,
  AttendanceEvaluationLookupRow,
} from "./AdminAttendanceTypes";

const CSV_FILENAME = 'attachment; filename="absensi.csv"';

/** Buat response CSV attendance admin. */
export function toCsvResponse(rows: string[][]) {
  const sanitize = (value: string) =>
    /^[=+\-@]/.test(value) ? `'${value}` : value;
  const csvContent = rows
    .map((row) => row.map((cell) => `"${sanitize(cell)}"`).join(","))
    .join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": CSV_FILENAME,
    },
  });
}

/** Bangun baris CSV untuk export attendance admin. */
export function buildExportRows(
  attendances: Array<
    AdminAttendanceRow & {
      user: {
        name: string | null;
        sites?: { name: string } | null;
        departments?: { name: string } | null;
      };
    }
  >,
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  timezone: string,
) {
  const rows = [
    [
      "No",
      "Karyawan",
      "Site",
      "Departemen",
      "Tanggal",
      "Jam Masuk",
      "Jam Pulang",
      "Status",
      "Keterangan",
      "Evidence Quality",
    ],
  ];

  attendances.forEach((item, index) => {
    const evaluation = evaluationMap.get(
      buildAttendanceEvaluationKey(item, timezone),
    );
    rows.push(buildExportRow(item, evaluation, timezone, index));
  });

  return rows;
}

function buildExportRow(
  item: AdminAttendanceRow & {
    user: {
      name: string | null;
      sites?: { name: string } | null;
      departments?: { name: string } | null;
    };
  },
  evaluation: AttendanceEvaluationLookupRow | undefined,
  timezone: string,
  index: number,
) {
  const checkInDate = new Date(item.checkIn);
  const checkOutDate = item.checkOut ? new Date(item.checkOut) : null;
  const effectiveStatus = getEffectiveAttendanceStatus(item, evaluation);
  const isAbsentOrLeave = isAttendanceWithoutTime(effectiveStatus, item);
  return [
    String(index + 1),
    item.user.name || "-",
    item.user.sites?.name || "-",
    item.user.departments?.name || "-",
    formatDate(checkInDate, timezone),
    formatCheckIn(checkInDate, timezone, isAbsentOrLeave),
    formatCheckOut(
      checkOutDate,
      timezone,
      effectiveStatus,
      isAbsentOrLeave,
      item,
    ),
    getAttendanceDisplayStatus(item, evaluation),
    item.notes || "-",
    evaluation?.evidenceQuality || "-",
  ];
}

function isAttendanceWithoutTime(
  effectiveStatus: string,
  item: AdminAttendanceRow,
) {
  return (
    ["ALPHA", "ABSENT", "SICK", "PERMIT", "DAY_OFF"].includes(
      effectiveStatus,
    ) && !isHistoricalAutoCheckoutAbsence(item)
  );
}

function formatDate(date: Date, timezone: string) {
  return date.toLocaleDateString("id-ID", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date: Date, timezone: string) {
  return date
    .toLocaleTimeString("id-ID", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\./g, ":");
}

function formatCheckIn(date: Date, timezone: string, isAbsentOrLeave: boolean) {
  return isAbsentOrLeave ? "-" : formatTime(date, timezone);
}

function formatCheckOut(
  date: Date | null,
  timezone: string,
  effectiveStatus: string,
  isAbsentOrLeave: boolean,
  item: AdminAttendanceRow,
) {
  if (isAbsentOrLeave || effectiveStatus === "NO_CHECKOUT") return "-";
  if (isHistoricalAutoCheckoutAbsence(item) || !date) return "-";
  return formatTime(date, timezone);
}
