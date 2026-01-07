import { PrismaClient } from '@prisma/client'
import type { IOLTRepository, OLTCreateData, OLTUpdateData, OLTPublic } from './IOLTRepository'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export class OLTRepository implements IOLTRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(siteId?: string): Promise<OLTPublic[]> {
    const olts = await this.client.olt.findMany({
      where: siteId ? { siteId } : {},
      orderBy: { createdAt: 'desc' },
    })
    return olts
  }

  async findById(id: string): Promise<OLTPublic | null> {
    const olt = await this.client.olt.findUnique({
      where: { id },
    })
    return olt
  }

  async create(data: OLTCreateData): Promise<{ id: string }> {
    const olt = await this.client.olt.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: data.name,
        ipAddress: data.ipAddress,
        type: data.type,
        version: data.version ?? null,
        temperature: data.temperature ?? null,
        connectedDevices: data.connectedDevices ?? 0,
        model: data.model ?? null,
        uptime: data.uptime ?? null,
        syncStatus: data.syncStatus ?? '0',
        syncDate: data.syncDate ?? null,
        telnetConnected: data.telnetConnected ?? false,
        snmpConnected: data.snmpConnected ?? false,
        snmpCommunityWrite: data.snmpCommunityWrite ?? 'public',
        snmpVersion: data.snmpVersion ?? '2',
        snmpPort: data.snmpPort ?? 161,
        telnetUsername: data.telnetUsername ?? 'zte',
        telnetPassword: data.telnetPassword,
        telnetPort: data.telnetPort ?? 23,
        siteId: data.siteId,
      },
      select: { id: true },
    })
    return olt
  }

  async update(id: string, data: OLTUpdateData): Promise<void> {
    await this.client.olt.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.version !== undefined && { version: data.version }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.connectedDevices !== undefined && { connectedDevices: data.connectedDevices }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.uptime !== undefined && { uptime: data.uptime }),
        ...(data.syncStatus !== undefined && { syncStatus: data.syncStatus }),
        ...(data.syncDate !== undefined && { syncDate: data.syncDate }),
        ...(data.telnetConnected !== undefined && { telnetConnected: data.telnetConnected }),
        ...(data.snmpConnected !== undefined && { snmpConnected: data.snmpConnected }),
        ...(data.snmpCommunityWrite !== undefined && { snmpCommunityWrite: data.snmpCommunityWrite }),
        ...(data.snmpVersion !== undefined && { snmpVersion: data.snmpVersion }),
        ...(data.snmpPort !== undefined && { snmpPort: data.snmpPort }),
        ...(data.telnetUsername !== undefined && { telnetUsername: data.telnetUsername }),
        ...(data.telnetPassword !== undefined && { telnetPassword: data.telnetPassword }),
        ...(data.telnetPort !== undefined && { telnetPort: data.telnetPort }),
        ...(data.siteId !== undefined && { siteId: data.siteId }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.olt.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.olt.count()
  }
}

