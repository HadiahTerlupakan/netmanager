function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} mnt`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} mnt`;
}

/** Total lokasi tidak terkirim selama sesi kerja; kosong bila tidak ada. */
export function TrackingOffNote({ minutes }: { minutes: number | null }) {
  if (!minutes) return null;
  return (
    <div
      className="text-[10px] font-medium text-red-600 dark:text-red-400"
      title="Total jeda tanpa lokasi lebih dari 45 menit selama sesi kerja"
    >
      Tracking mati {formatDuration(minutes)}
    </div>
  );
}
