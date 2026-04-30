import { toStartOfDay } from "@/lib/utils/server-datetime";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const ZERO_BYTES = BigInt(0);

export const getStartOfCurrentMonth = () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setTime(toStartOfDay(startOfMonth).getTime());
  return startOfMonth;
};

export const calculateSessionDuration = (
  acctStartTime?: Date | string | null,
  now: number = Date.now(),
) => {
  if (!acctStartTime) return 0;
  return Math.floor((now - new Date(acctStartTime).getTime()) / 1000);
};

export const formatBytesValue = (bytes: bigint | null) => {
  if (!bytes) return { bytes: 0, formatted: "0 B" };
  const numericBytes = Number(bytes);
  if (numericBytes === 0) return { bytes: 0, formatted: "0 B" };

  const unitIndex = Math.floor(Math.log(numericBytes) / Math.log(1024));
  const formattedValue = parseFloat(
    (numericBytes / Math.pow(1024, unitIndex)).toFixed(2),
  );

  return {
    bytes: numericBytes,
    formatted: `${formattedValue} ${BYTE_UNITS[unitIndex]}`,
  };
};

export const formatDurationValue = (seconds: number) => {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const remainingSeconds = seconds % SECONDS_PER_MINUTE;

  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}d`;
  return `${remainingSeconds}d`;
};

export const sumUsageOctets = (
  downloadBytes?: bigint | null,
  uploadBytes?: bigint | null,
) => (downloadBytes || ZERO_BYTES) + (uploadBytes || ZERO_BYTES);
