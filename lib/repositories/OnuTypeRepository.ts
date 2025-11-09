import { PrismaClient } from '@prisma/client'
import { IOnuTypeRepository, OnuTypeCreateData, OnuTypeUpdateData, OnuTypePublic } from './IOnuTypeRepository'
import { prisma } from '@/lib/prisma'

export class OnuTypeRepository implements IOnuTypeRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OnuTypePublic[]> {
    const onuTypes = await this.client.onuType.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return onuTypes
  }

  async findByOltId(oltId: string): Promise<OnuTypePublic[]> {
    const onuTypes = await this.client.onuType.findMany({
      where: { oltId },
      orderBy: { name: 'asc' },
    })
    return onuTypes
  }

  async findById(id: string): Promise<OnuTypePublic | null> {
    const onuType = await this.client.onuType.findUnique({
      where: { id },
    })
    return onuType
  }

  async create(data: OnuTypeCreateData): Promise<{ id: string }> {
    // Build data object, hanya include field yang terdefinisi (bukan undefined)
    const createData: any = {
      oltId: data.oltId,
      name: data.name,
      ethernetPorts: data.ethernetPorts,
      wifi: data.wifi,
      voipPorts: data.voipPorts,
    }
    
    // Hanya tambahkan field optional jika terdefinisi
    if (data.ponType !== undefined) createData.ponType = data.ponType
    if (data.description !== undefined) createData.description = data.description
    if (data.maxTcont !== undefined) createData.maxTcont = data.maxTcont
    if (data.maxGemPort !== undefined) createData.maxGemPort = data.maxGemPort
    if (data.maxSwitchPerSlot !== undefined) createData.maxSwitchPerSlot = data.maxSwitchPerSlot
    if (data.maxFlowPerSwitch !== undefined) createData.maxFlowPerSwitch = data.maxFlowPerSwitch
    if (data.maxIpHost !== undefined) createData.maxIpHost = data.maxIpHost
    if (data.maxIpv6Host !== undefined) createData.maxIpv6Host = data.maxIpv6Host
    if (data.serviceAbilityN1 !== undefined) createData.serviceAbilityN1 = data.serviceAbilityN1
    if (data.serviceAbility1M !== undefined) createData.serviceAbility1M = data.serviceAbility1M
    if (data.serviceAbility1P !== undefined) createData.serviceAbility1P = data.serviceAbility1P
    if (data.wifiMgmtViaNonOmci !== undefined) createData.wifiMgmtViaNonOmci = data.wifiMgmtViaNonOmci
    if (data.omciSendMode !== undefined) createData.omciSendMode = data.omciSendMode
    if (data.defaultMulticastRange !== undefined) createData.defaultMulticastRange = data.defaultMulticastRange
    if (data.vrg !== undefined) createData.vrg = data.vrg
    if (data.mgcConfigureMode !== undefined) createData.mgcConfigureMode = data.mgcConfigureMode
    if (data.maxVeip !== undefined) createData.maxVeip = data.maxVeip
    if (data.extendedOmci !== undefined) createData.extendedOmci = data.extendedOmci
    if (data.location !== undefined) createData.location = data.location

    const onuType = await this.client.onuType.create({
      data: createData,
      select: { id: true },
    })
    return onuType
  }

  async update(id: string, data: OnuTypeUpdateData): Promise<void> {
    // Build data object, hanya include field yang terdefinisi (bukan undefined)
    const updateData: any = {}
    
    // Hanya tambahkan field jika terdefinisi
    if (data.name !== undefined) updateData.name = data.name
    if (data.ethernetPorts !== undefined) updateData.ethernetPorts = data.ethernetPorts
    if (data.wifi !== undefined) updateData.wifi = data.wifi
    if (data.voipPorts !== undefined) updateData.voipPorts = data.voipPorts
    if (data.ponType !== undefined) updateData.ponType = data.ponType
    if (data.description !== undefined) updateData.description = data.description
    if (data.maxTcont !== undefined) updateData.maxTcont = data.maxTcont
    if (data.maxGemPort !== undefined) updateData.maxGemPort = data.maxGemPort
    if (data.maxSwitchPerSlot !== undefined) updateData.maxSwitchPerSlot = data.maxSwitchPerSlot
    if (data.maxFlowPerSwitch !== undefined) updateData.maxFlowPerSwitch = data.maxFlowPerSwitch
    if (data.maxIpHost !== undefined) updateData.maxIpHost = data.maxIpHost
    if (data.maxIpv6Host !== undefined) updateData.maxIpv6Host = data.maxIpv6Host
    if (data.serviceAbilityN1 !== undefined) updateData.serviceAbilityN1 = data.serviceAbilityN1
    if (data.serviceAbility1M !== undefined) updateData.serviceAbility1M = data.serviceAbility1M
    if (data.serviceAbility1P !== undefined) updateData.serviceAbility1P = data.serviceAbility1P
    if (data.wifiMgmtViaNonOmci !== undefined) updateData.wifiMgmtViaNonOmci = data.wifiMgmtViaNonOmci
    if (data.omciSendMode !== undefined) updateData.omciSendMode = data.omciSendMode
    if (data.defaultMulticastRange !== undefined) updateData.defaultMulticastRange = data.defaultMulticastRange
    if (data.vrg !== undefined) updateData.vrg = data.vrg
    if (data.mgcConfigureMode !== undefined) updateData.mgcConfigureMode = data.mgcConfigureMode
    if (data.maxVeip !== undefined) updateData.maxVeip = data.maxVeip
    if (data.extendedOmci !== undefined) updateData.extendedOmci = data.extendedOmci
    if (data.location !== undefined) updateData.location = data.location

    await this.client.onuType.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.onuType.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.onuType.count()
  }
}

