import { prisma } from "@/modules/database";
import { redis } from "@/lib/redis";

const BYTE_TO_MB_DIVISOR = 1024 * 1024;
const PERCENTAGE_MULTIPLIER = 100;

interface ServiceHealthDTO {
  status: "healthy" | "unhealthy" | "unknown";
  responseTime: number;
}

interface HealthResponseDTO {
  status: "healthy" | "unhealthy";
  timestamp: string;
  services: {
    database: ServiceHealthDTO;
    redis: ServiceHealthDTO;
  };
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedPercentage: number;
    unit: "MB";
  };
}

/** Service untuk kebutuhan health check route. */
export class HealthCheckRouteService {
  /** Ambil status kesehatan aplikasi dan dependensi utama. */
  async getHealth(): Promise<HealthResponseDTO> {
    const database = await this.checkDatabase();
    const cache = await this.checkRedis();
    return this.buildHealthResponse(database, cache);
  }

  private async checkDatabase(): Promise<ServiceHealthDTO> {
    const startedAt = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      return this.buildServiceHealth("healthy", startedAt);
    } catch {
      return { status: "unhealthy", responseTime: 0 };
    }
  }

  private async checkRedis(): Promise<ServiceHealthDTO> {
    const startedAt = Date.now();

    try {
      await redis.ping();
      return this.buildServiceHealth("healthy", startedAt);
    } catch {
      return { status: "unhealthy", responseTime: 0 };
    }
  }

  private buildServiceHealth(
    status: ServiceHealthDTO["status"],
    startedAt: number,
  ): ServiceHealthDTO {
    return { status, responseTime: Date.now() - startedAt };
  }

  private buildHealthResponse(
    database: ServiceHealthDTO,
    cache: ServiceHealthDTO,
  ): HealthResponseDTO {
    return {
      status: database.status === "healthy" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: { database, redis: cache },
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
    };
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: this.toMB(usage.heapUsed),
      heapTotal: this.toMB(usage.heapTotal),
      rss: this.toMB(usage.rss),
      external: this.toMB(usage.external),
      heapUsedPercentage: this.toPercent(usage.heapUsed, usage.heapTotal),
      unit: "MB" as const,
    };
  }

  private toMB(value: number): number {
    return Math.round(value / BYTE_TO_MB_DIVISOR);
  }

  private toPercent(value: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.round((value / total) * PERCENTAGE_MULTIPLIER);
  }
}
