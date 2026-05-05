import type { prisma as defaultPrisma } from "@/lib/prisma";

export type PrismaInstance = typeof defaultPrisma;

export type RadiusSyncOperations = {
  deleteRadiusUser(username: string, tenantId: string): Promise<void>;
  userExists(username: string, tenantId: string): Promise<boolean>;
  createRadiusUser(
    data: { username: string; password: string },
    tenantId: string,
  ): Promise<void>;
  updateRadiusPassword(
    username: string,
    password: string,
    tenantId: string,
  ): Promise<void>;
  assignUserToGroup(
    username: string,
    groupname: string,
    tenantId: string,
    priority?: number,
  ): Promise<void>;
  getUserGroups(username: string, tenantId: string): Promise<string[]>;
  removeUserFromGroup(
    username: string,
    groupname: string,
    tenantId: string,
  ): Promise<void>;
  setGroupAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
  ): Promise<void>;
  removeGroupAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;
  setGroupCheckAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op?: string,
  ): Promise<void>;
  removeGroupCheckAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;
  setGroupBandwidth(
    groupname: string,
    bandwidth: string,
    tenantId: string,
  ): Promise<void>;
};

export type RadiusClient = {
  radreply: {
    deleteMany(args: unknown): Promise<unknown>;
  };
};
