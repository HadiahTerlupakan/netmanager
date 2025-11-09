import { z } from 'zod'

export const onuTypeCreateSchema = z.object({
  oltId: z.string().min(1, 'OLT ID harus diisi'),
  name: z.string().min(1, 'Nama ONU Type harus diisi'),
  ethernetPorts: z.number().int().min(0, 'Ethernet Ports harus >= 0').default(0),
  wifi: z.number().int().min(0, 'Wifi harus >= 0').default(0),
  voipPorts: z.number().int().min(0, 'VoIP Ports harus >= 0').default(0),
})

export const onuTypeUpdateSchema = z.object({
  name: z.string().min(1, 'Nama ONU Type harus diisi').optional(),
  ethernetPorts: z.number().int().min(0, 'Ethernet Ports harus >= 0').optional(),
  wifi: z.number().int().min(0, 'Wifi harus >= 0').optional(),
  voipPorts: z.number().int().min(0, 'VoIP Ports harus >= 0').optional(),
})

