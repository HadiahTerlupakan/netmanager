interface OvertimeSummaryCardsProps {
  summary: Record<string, number>;
  totalItems: number;
}

export function OvertimeSummaryCards({
  summary,
  totalItems,
}: OvertimeSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Object.entries(summary).map(([key, count]) => (
        <div
          key={key}
          className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {key.toLowerCase().replace("_", " ")}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {count}
          </div>
        </div>
      ))}
      <div className="bg-indigo-50 p-4 rounded-lg shadow border border-indigo-100 dark:bg-indigo-900/20">
        <div className="text-sm text-indigo-600 dark:text-indigo-400">
          Total Filtered
        </div>
        <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
          {totalItems}
        </div>
      </div>
    </div>
  );
}
