import { randomUUID } from 'crypto'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/modules/database'
import { logActivitySafe } from '@/lib/logger'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  const settingsKeys = [
    'ACS_GENIEACS_URL',
    'ACS_APP_NAME',
    'ACS_VP_PPPOE_USERNAME',
    'ACS_VP_RX_POWER',
    'ACS_VP_ACTIVE_DEVICES',
    'ACS_VP_WAN_BRIDGE',
    'ACS_VP_TEMPERATURE',
    'ACS_VP_SUPER_ADMIN',
    'ACS_VP_SUPER_PASSWORD',
    'ACS_VP_USER_ADMIN',
    'ACS_VP_USER_PASSWORD',
    'ACS_RX_POWER_EXCELLENT',
    'ACS_RX_POWER_FAIR',
    'ACS_DEVICE_DATA_INTERVAL',
    'ACS_MAPPING_DATA_INTERVAL',
    'ACS_DASHBOARD_DATA_INTERVAL',
    'ACS_DEVICE_STATUS_INTERVAL',
    'ACS_DEVICE_ONLINE_THRESHOLD',
    'ACS_PORTAL_API_KEY',
    'ACS_TELEGRAM_BOT_TOKEN',
    'ACS_TELEGRAM_CHAT_IDS',
    'ACS_TELEGRAM_BOT_ENABLED',
  ]

  const settings = await prisma.settings.findMany({
    where: { key: { in: settingsKeys } },
  })

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

  return apiSuccess({
    genieAcsUrl: settingsMap.get('ACS_GENIEACS_URL') || 'http://localhost:7557/devices',
    appName: settingsMap.get('ACS_APP_NAME') || 'SolusiDigitalNet',
    vpPppoeUsername: settingsMap.get('ACS_VP_PPPOE_USERNAME') || 'VirtualParameters.pppoeUsername2',
    vpRxPower: settingsMap.get('ACS_VP_RX_POWER') || 'VirtualParameters.RXPower',
    vpActiveDevices: settingsMap.get('ACS_VP_ACTIVE_DEVICES') || 'VirtualParameters.activedevices',
    vpWanBridge: settingsMap.get('ACS_VP_WAN_BRIDGE') || 'VirtualParameters.WANBridge',
    vpTemperature: settingsMap.get('ACS_VP_TEMPERATURE') || 'VirtualParameters.gettemp',
    vpSuperAdmin: settingsMap.get('ACS_VP_SUPER_ADMIN') || 'VirtualParameters.superAdmin',
    vpSuperPassword: settingsMap.get('ACS_VP_SUPER_PASSWORD') || 'VirtualParameters.superPassword',
    vpUserAdmin: settingsMap.get('ACS_VP_USER_ADMIN') || 'VirtualParameters.userAdmin',
    vpUserPassword: settingsMap.get('ACS_VP_USER_PASSWORD') || 'VirtualParameters.userPassword',
    rxPowerExcellent: Number(settingsMap.get('ACS_RX_POWER_EXCELLENT') || '-23'),
    rxPowerFair: Number(settingsMap.get('ACS_RX_POWER_FAIR') || '-26'),
    deviceDataInterval: Number(settingsMap.get('ACS_DEVICE_DATA_INTERVAL') || '5.5'),
    mappingDataInterval: Number(settingsMap.get('ACS_MAPPING_DATA_INTERVAL') || '5.5'),
    dashboardDataInterval: Number(settingsMap.get('ACS_DASHBOARD_DATA_INTERVAL') || '5.5'),
    deviceStatusInterval: Number(settingsMap.get('ACS_DEVICE_STATUS_INTERVAL') || '0.5'),
    deviceOnlineThreshold: Number(settingsMap.get('ACS_DEVICE_ONLINE_THRESHOLD') || '10'),
    portalApiKey: settingsMap.get('ACS_PORTAL_API_KEY') || '',
    telegramBotToken: settingsMap.get('ACS_TELEGRAM_BOT_TOKEN') || '',
    telegramChatIds: settingsMap.get('ACS_TELEGRAM_CHAT_IDS') || '',
    telegramBotEnabled: settingsMap.get('ACS_TELEGRAM_BOT_ENABLED') === 'true',
  })
})

export const POST = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const body = await req.json()

  if (!body || typeof body !== 'object') {
    return ApiErrors.badRequest('Body request tidak valid')
  }

  const settingsToSave = [
    { key: 'ACS_GENIEACS_URL', value: body.genieAcsUrl?.trim() || null },
    { key: 'ACS_APP_NAME', value: body.appName?.trim() || null },
    { key: 'ACS_VP_PPPOE_USERNAME', value: body.vpPppoeUsername?.trim() || null },
    { key: 'ACS_VP_RX_POWER', value: body.vpRxPower?.trim() || null },
    { key: 'ACS_VP_ACTIVE_DEVICES', value: body.vpActiveDevices?.trim() || null },
    { key: 'ACS_VP_WAN_BRIDGE', value: body.vpWanBridge?.trim() || null },
    { key: 'ACS_VP_TEMPERATURE', value: body.vpTemperature?.trim() || null },
    { key: 'ACS_VP_SUPER_ADMIN', value: body.vpSuperAdmin?.trim() || null },
    { key: 'ACS_VP_SUPER_PASSWORD', value: body.vpSuperPassword?.trim() || null },
    { key: 'ACS_VP_USER_ADMIN', value: body.vpUserAdmin?.trim() || null },
    { key: 'ACS_VP_USER_PASSWORD', value: body.vpUserPassword?.trim() || null },
    { key: 'ACS_RX_POWER_EXCELLENT', value: body.rxPowerExcellent?.toString() || '-23' },
    { key: 'ACS_RX_POWER_FAIR', value: body.rxPowerFair?.toString() || '-26' },
    { key: 'ACS_DEVICE_DATA_INTERVAL', value: body.deviceDataInterval?.toString() || '5.5' },
    { key: 'ACS_MAPPING_DATA_INTERVAL', value: body.mappingDataInterval?.toString() || '5.5' },
    { key: 'ACS_DASHBOARD_DATA_INTERVAL', value: body.dashboardDataInterval?.toString() || '5.5' },
    { key: 'ACS_DEVICE_STATUS_INTERVAL', value: body.deviceStatusInterval?.toString() || '0.5' },
    { key: 'ACS_DEVICE_ONLINE_THRESHOLD', value: body.deviceOnlineThreshold?.toString() || '10' },
    { key: 'ACS_PORTAL_API_KEY', value: body.portalApiKey?.trim() || null },
    { key: 'ACS_TELEGRAM_BOT_TOKEN', value: body.telegramBotToken?.trim() || null },
    { key: 'ACS_TELEGRAM_CHAT_IDS', value: body.telegramChatIds?.trim() || null },
    { key: 'ACS_TELEGRAM_BOT_ENABLED', value: body.telegramBotEnabled ? 'true' : 'false' },
  ]

  await Promise.all(
    settingsToSave.map(async ({ key, value }) => {
      const existing = await prisma.settings.findFirst({
        where: { key }
      })
      if (existing) {
        return prisma.settings.update({
          where: { id: existing.id },
          data: { value, updatedAt: new Date() }
        })
      } else {
        return prisma.settings.create({
          data: { id: randomUUID(), key, value, encrypted: false, updatedAt: new Date() }
        })
      }
    })
  )

  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'UPDATE',
      subject: 'ACS Settings',
      userId: ctx.session.user.id,
      details: { type: 'ACS', updates: body }
    })
  }

  return apiSuccess({ success: true })
})
