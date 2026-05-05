import type { SalesPeriod } from "./admin-user-performance.period";
import type {
  mapCanvasingStats,
  mapPointStats,
} from "./admin-user-performance.stats";

const DEFAULT_CANVASING_TARGET = 50;

/** Membangun ringkasan performa sales untuk route admin. */
export function buildSalesPerformanceSummary(input: {
  user: { id: string; name: string | null; canvasingTarget: number | null };
  period: SalesPeriod;
  canvasing: ReturnType<typeof mapCanvasingStats>;
  points: ReturnType<typeof mapPointStats>;
  totalAllTime: number;
  totalPointsAllTime: number;
  recentActivityRaw: Array<{
    id: string;
    nama: string | null;
    status: string;
    createdAt: Date;
    alamat: string | null;
    pointClaims: unknown;
  }>;
}) {
  const target = input.user.canvasingTarget || DEFAULT_CANVASING_TARGET;

  return {
    user: input.user,
    period: input.period,
    target,
    canvasing: {
      ...input.canvasing,
      progress: Math.round((input.canvasing.approved / target) * 100),
    },
    points: input.points,
    totalAllTime: input.totalAllTime,
    totalPointsAllTime: input.totalPointsAllTime,
    recentActivity: input.recentActivityRaw.map((activity) => ({
      id: activity.id,
      pelangganName: activity.nama,
      status: activity.status,
      createdAt: activity.createdAt,
      address: activity.alamat,
      pointClaim: activity.pointClaims || null,
    })),
  };
}
