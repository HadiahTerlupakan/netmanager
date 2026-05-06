interface InlineAlertProps {
  tone: "error" | "success";
  message: string;
  onClose: () => void;
}

export function InlineAlert({ tone, message, onClose }: InlineAlertProps) {
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
      : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300";

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>
      {message}
      <button type="button" onClick={onClose} className="ml-2 underline">
        Tutup
      </button>
    </div>
  );
}
