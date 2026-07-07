import { useEffect } from "react";

/** Registers Chart.js primitives required by report charts. */
export function useReportChartRegistration() {
  useEffect(() => {
    const initChart = async () => {
      const {
        Chart: ChartJS,
        CategoryScale,
        LinearScale,
        BarElement,
        Title,
        Tooltip,
        Legend,
        PointElement,
        LineElement,
        ArcElement,
      } = await import("chart.js");

      ChartJS.register(
        CategoryScale,
        LinearScale,
        BarElement,
        Title,
        Tooltip,
        Legend,
        PointElement,
        LineElement,
        ArcElement,
      );
    };
    void initChart();
  }, []);
}
