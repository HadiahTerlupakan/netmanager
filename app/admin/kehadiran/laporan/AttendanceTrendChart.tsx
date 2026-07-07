import dynamic from "next/dynamic";
import type { AttendanceTrend } from "./types";

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
      Loading Chart...
    </div>
  ),
});

interface AttendanceTrendChartProps {
  readonly trends: readonly AttendanceTrend[];
}

/** Renders the daily attendance trend line chart. */
export function AttendanceTrendChart({ trends }: AttendanceTrendChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
        Tren Kehadiran (Harian)
      </h3>
      <div className="h-64">
        <Line
          data={{
            labels: trends.map((trend) => trend.date),
            datasets: [
              {
                label: "Hadir",
                data: trends.map((trend) => trend.present),
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.5)",
                tension: 0.3,
              },
              {
                label: "Terlambat",
                data: trends.map((trend) => trend.late),
                borderColor: "rgb(234, 179, 8)",
                backgroundColor: "rgba(234, 179, 8, 0.5)",
                tension: 0.3,
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
