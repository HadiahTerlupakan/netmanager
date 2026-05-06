import { HiCheckCircle, HiExclamationCircle } from "react-icons/hi2";

interface StatusAlertProps {
  type: "success" | "error";
  message: string;
}

/**
 * Reusable alert component for success/error messages.
 */
export function StatusAlert({ type, message }: StatusAlertProps) {
  const isSuccess = type === "success";

  const containerClass = isSuccess
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  const textClass = isSuccess
    ? "text-green-800 dark:text-green-400"
    : "text-red-800 dark:text-red-400";

  const iconClass = isSuccess
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  const Icon = isSuccess ? HiCheckCircle : HiExclamationCircle;

  return (
    <div
      className={`border rounded-lg p-4 flex items-start gap-3 ${containerClass}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} />
      <p className={`text-sm font-medium ${textClass}`}>{message}</p>
    </div>
  );
}
