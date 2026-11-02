/**
 * Baris galat di dalam modal chat. Modal menutupi toast (z-index lebih
 * tinggi), jadi galat di modal ditampilkan langsung di dalamnya.
 */
export function ChatFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300"
    >
      {message}
    </p>
  );
}
