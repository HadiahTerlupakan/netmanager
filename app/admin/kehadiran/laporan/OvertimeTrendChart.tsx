import dynamic from "next/dynamic";
import type { OvertimeTrend } from "./types";

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
      Loading Chart...
    </div>
  ),
});

interface OvertimeTrendChartProps {
  readonly trends: readonly OvertimeTrend[];
}

/** Renders the overtime duration trend bar chart. */
export function OvertimeTrendChart({ trends }: OvertimeTrendChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
        Tren Lembur (Menit)
      </h3>
      <div className="h-64">
        <Bar
          data={{
            labels: trends.map((trend) => trend.date),
            datasets: [
              {
                label: "Durasi Lembur (Menit)",
                data: trends.map((trend) => trend.duration),
                backgroundColor: "rgba(147, 51, 234, 0.6)",
                borderRadius: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "top" as const },
            },
          }}
        />
      </div>
    </div>
  );
}
