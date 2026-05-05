import { prismaRadius } from "@/lib/prisma-radius";
import type { prisma as defaultPrisma } from "@/lib/prisma";

import type {
  RadiusBandwidthEntity,
  RadiusUserEntity,
} from "../domain/entities/RadiusEntity";
import {
  parseRadiusRateLimitMbps,
  toRadiusRateLimitMbps,
} from "../utils/radius-rate-limit";
import {
  CLEAR_TEXT_PASSWORD_ATTRIBUTE,
  DEFAULT_GROUP_PRIORITY,
  GROUP_CHECK_MATCH_OP,
  GROUP_REPLY_ASSIGN_OP,
  MIKROTIK_RATE_LIMIT_ATTRIBUTE,
} from "./radiusRepository.constants";

type PrismaInstance = typeof defaultPrisma;

export abstract class RadiusRepositoryCoreBase {
  protected readonly radiusClient: typeof prismaRadius;

  constructor(
    protected prisma: PrismaInstance,
    radiusClient?: typeof prismaRadius,
  ) {
    this.radiusClient = radiusClient || prismaRadius;
  }

  async createRadiusUser(
    data: RadiusUserEntity,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radcheck.create({
      data: {
        username: data.username,
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
        op: ":=",
        value: data.password,
        tenantId,
      },
    });

    if (data.groupname) {
      await this.assignUserToGroup(data.username, data.groupname, tenantId);
    }
  }

  async updateRadiusPassword(
    username: string,
    password: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radcheck.updateMany({
      where: {
        username,
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
        tenantId,
      },
      data: { value: password },
    });
  }

  async deleteRadiusUser(username: string, tenantId: string): Promise<void> {
    await this.radiusClient.$transaction([
      this.radiusClient.radcheck.deleteMany({ where: { username, tenantId } }),
      this.radiusClient.radreply.deleteMany({ where: { username, tenantId } }),
      this.radiusClient.radusergroup.deleteMany({
        where: { username, tenantId },
      }),
    ]);
  }

  async userExists(username: string, tenantId: string): Promise<boolean> {
    const count = await this.radiusClient.radcheck.count({
      where: {
        username,
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
        tenantId,
      },
    });
    return count > 0;
  }

  async setUserBandwidth(
    username: string,
    bandwidth: RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void> {
    const rateLimit = toRadiusRateLimitMbps(bandwidth);
    await this.radiusClient.radreply.deleteMany({
      where: {
        username,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });
    await this.radiusClient.radreply.create({
      data: {
        username,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        op: GROUP_REPLY_ASSIGN_OP,
        value: rateLimit,
        tenantId,
      },
    });
  }

  async getUserBandwidth(
    username: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null> {
    const reply = await this.radiusClient.radreply.findFirst({
      where: {
        username,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });
    return reply ? parseRadiusRateLimitMbps(reply.value) : null;
  }

  async setGroupBandwidth(
    groupname: string,
    bandwidth: string | RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void> {
    const rateLimit =
      typeof bandwidth === "string"
        ? bandwidth
        : toRadiusRateLimitMbps(bandwidth);
    await this.radiusClient.radgroupreply.deleteMany({
      where: {
        groupname,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });
    await this.radiusClient.radgroupreply.create({
      data: {
        groupname,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        op: GROUP_REPLY_ASSIGN_OP,
        value: rateLimit,
        tenantId,
      },
    });
  }

  async setGroupCheckAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op = GROUP_CHECK_MATCH_OP,
  ): Promise<void> {
    await this.radiusClient.radgroupcheck.deleteMany({
      where: { groupname, attribute, tenantId },
    });
    await this.radiusClient.radgroupcheck.create({
      data: { groupname, attribute, op, value, tenantId },
    });
  }

  async removeGroupCheckAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radgroupcheck.deleteMany({
      where: { groupname, attribute, tenantId },
    });
  }

  async setGroupAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op = GROUP_REPLY_ASSIGN_OP,
  ): Promise<void> {
    await this.radiusClient.radgroupreply.deleteMany({
      where: { groupname, attribute, tenantId },
    });
    await this.radiusClient.radgroupreply.create({
      data: { groupname, attribute, op, value, tenantId },
    });
  }

  async removeGroupAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radgroupreply.deleteMany({
      where: { groupname, attribute, tenantId },
    });
  }

  async getGroupBandwidth(
    groupname: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null> {
    const reply = await this.radiusClient.radgroupreply.findFirst({
      where: {
        groupname,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });
    return reply ? parseRadiusRateLimitMbps(reply.value) : null;
  }

  async assignUserToGroup(
    username: string,
    groupname: string,
    tenantId: string,
    priority = DEFAULT_GROUP_PRIORITY,
  ): Promise<void> {
    const existing = await this.radiusClient.radusergroup.findFirst({
      where: { username, groupname, tenantId },
    });
    if (existing) {
      await this.radiusClient.radusergroup.update({
        where: { id: existing.id },
        data: { priority },
      });
      return;
    }

    await this.radiusClient.radusergroup.create({
      data: { username, groupname, priority, tenantId },
    });
  }

  async removeUserFromGroup(
    username: string,
    groupname: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radusergroup.deleteMany({
      where: { username, groupname, tenantId },
    });
  }

  async getUserGroups(username: string, tenantId: string): Promise<string[]> {
    const groups = await this.radiusClient.radusergroup.findMany({
      where: { username, tenantId },
      orderBy: { priority: "asc" },
    });
    return groups.map((group) => group.groupname);
  }
}
