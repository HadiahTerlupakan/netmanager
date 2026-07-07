import { MdTimer } from "react-icons/md";

interface RateLimitWarningProps {
  readonly retryCountdown: number;
}

/** Shows rate-limit feedback while report requests are paused. */
export function RateLimitWarning({ retryCountdown }: RateLimitWarningProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 dark:bg-yellow-900/20 dark:border-yellow-800">
      <MdTimer className="text-yellow-600 text-xl" />
      <div>
        <p className="font-medium text-yellow-800 dark:text-yellow-200">
          Terlalu Banyak Permintaan
        </p>
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Mohon tunggu {retryCountdown} detik sebelum memuat ulang...
        </p>
      </div>
    </div>
  );
}
