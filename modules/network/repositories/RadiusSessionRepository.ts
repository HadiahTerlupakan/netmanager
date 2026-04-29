import { prismaRadius } from "@/lib/prisma-radius";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type {
  DashboardStatsEntity,
  RadiusAccountingStatsEntity,
  RadiusSessionEntity,
  RadiusSessionHistoryOptionsEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionTotalsEntity,
  RadiusSessionViewEntity,
} from "../domain/entities/RadiusEntity";
import {
  ACTIVE_STATUS,
  CLEAR_TEXT_PASSWORD_ATTRIBUTE,
} from "./radiusRepository.constants";
import {
  buildSessionHistoryResult,
  buildSessionHistoryWhereClause,
  getRecentSessionPagination,
  getSessionHistoryPagination,
  toRoundedGigabytes,
} from "./radiusRepository.helpers";
import {
  toRecentSessionViewEntity,
  toSessionTotalsEntity,
} from "./radiusRepository.mappers";

export class RadiusSessionRepository {
  constructor(
    private readonly radiusClient: typeof prismaRadius = prismaRadius,
  ) {}

  async getActiveSessions(
    tenantId: string,
    username?: string,
  ): Promise<RadiusSessionEntity[]> {
    const sessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstoptime: null,
        tenantId,
        ...(username && { username }),
      },
      orderBy: {
        acctstarttime: "desc",
      },
    });

    return sessions as unknown as RadiusSessionEntity[];
  }

  async getUserSessions(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusSessionEntity[]> {
    const sessions = await this.radiusClient.radacct.findMany({
      where: {
        username,
        tenantId,
        ...(startDate && { acctstarttime: { gte: startDate } }),
        ...(endDate && { acctstarttime: { lte: endDate } }),
      },
      orderBy: {
        acctstarttime: "desc",
      },
    });

    return sessions as unknown as RadiusSessionEntity[];
  }

  async getAccountingStats(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusAccountingStatsEntity> {
    const sessions = await this.getUserSessions(
      username,
      tenantId,
      startDate,
      endDate,
    );

    const stats: RadiusAccountingStatsEntity = {
      username,
      totalSessions: sessions.length,
      totalSessionTime: BigInt(0),
      totalInputOctets: BigInt(0),
      totalOutputOctets: BigInt(0),
      activeSessions: 0,
    };

    for (const rawSession of sessions) {
      const session = rawSession as {
        acctsessiontime?: bigint | null;
        acctinputoctets?: bigint | null;
        acctoutputoctets?: bigint | null;
        acctstoptime?: Date | null;
      };
      if (session.acctsessiontime)
        stats.totalSessionTime += session.acctsessiontime;
      if (session.acctinputoctets)
        stats.totalInputOctets += session.acctinputoctets;
      if (session.acctoutputoctets)
        stats.totalOutputOctets += session.acctoutputoctets;
      if (!session.acctstoptime) stats.activeSessions++;
    }

    return stats;
  }

  async getDashboardStats(tenantId: string): Promise<DashboardStatsEntity> {
    const uniqueUsers = await this.radiusClient.radcheck.groupBy({
      by: ["username"],
      where: {
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
        tenantId,
      },
    });

    const onlineSessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstoptime: null,
        tenantId,
      },
      distinct: ["username"],
    });

    const today = new Date();
    today.setTime(toStartOfDay(today).getTime());

    const todaySessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstarttime: { gte: today },
        tenantId,
      },
    });

    let totalDownloadBytes = BigInt(0);
    let totalUploadBytes = BigInt(0);

    for (const session of todaySessions) {
      if (session.acctoutputoctets)
        totalDownloadBytes += session.acctoutputoctets;
      if (session.acctinputoctets) totalUploadBytes += session.acctinputoctets;
    }

    return {
      totalUsers: uniqueUsers.length,
      onlineUsers: onlineSessions.length,
      offlineUsers: uniqueUsers.length - onlineSessions.length,
      totalTrafficToday: {
        download: totalDownloadBytes.toString(),
        upload: totalUploadBytes.toString(),
        downloadGB: toRoundedGigabytes(totalDownloadBytes),
        uploadGB: toRoundedGigabytes(totalUploadBytes),
      },
      lastSyncTime: new Date().toISOString(),
      lastSyncStats: {
        created: 0,
        updated: 0,
        deleted: 0,
      },
    };
  }

  async getTotalUsageByUsernames(
    tenantId: string,
    usernames: string[],
  ): Promise<Record<string, RadiusSessionTotalsEntity>> {
    const uniqueUsernames = Array.from(
      new Set(usernames.map((username) => username.trim()).filter(Boolean)),
    );
    if (uniqueUsernames.length === 0) return {};

    const grouped = await this.radiusClient.radacct.groupBy({
      by: ["username"],
      where: {
        tenantId,
        username: { in: uniqueUsernames },
      },
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });

    const result: Record<string, RadiusSessionTotalsEntity> = {};
    for (const row of grouped) {
      const username = row.username;
      if (!username) continue;

      const downloadBytes = Number(row._sum.acctoutputoctets ?? 0);
      const uploadBytes = Number(row._sum.acctinputoctets ?? 0);
      result[username] = toSessionTotalsEntity(uploadBytes, downloadBytes);
    }

    return result;
  }

  async getUserSessionHistory(
    tenantId: string,
    username: string,
    options: RadiusSessionHistoryOptionsEntity = {},
  ): Promise<RadiusSessionHistoryResultEntity> {
    const { limit, skip } = getSessionHistoryPagination(options);
    const where = buildSessionHistoryWhereClause(tenantId, username, options);

    const [total, sessions, summaryRaw] = await Promise.all([
      this.radiusClient.radacct.count({ where }),
      this.radiusClient.radacct.findMany({
        where,
        orderBy: { acctstarttime: "desc" },
        skip,
        take: limit,
      }),
      this.radiusClient.radacct.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          acctsessiontime: true,
          acctinputoctets: true,
          acctoutputoctets: true,
        },
      }),
    ]);

    return buildSessionHistoryResult({ total, sessions, summaryRaw });
  }

  async getRecentSessions(
    tenantId: string,
    options: { page?: number; limit?: number; status?: "active" | "all" } = {},
  ): Promise<{ sessions: RadiusSessionViewEntity[]; total: number }> {
    const { limit, skip } = getRecentSessionPagination(options);
    const { status = ACTIVE_STATUS } = options;
    const where = {
      tenantId,
      ...(status === ACTIVE_STATUS ? { acctstoptime: null } : {}),
    };

    const total = await this.radiusClient.radacct.count({ where });
    const sessions = await this.radiusClient.radacct.findMany({
      where,
      orderBy: { acctstarttime: "desc" },
      skip,
      take: limit,
    });

    const now = new Date();
    return {
      sessions: sessions.map((session) =>
        toRecentSessionViewEntity(session, now),
      ),
      total,
    };
  }
}
