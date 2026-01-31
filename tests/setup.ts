import { beforeEach, vi } from 'vitest'
import { mockReset, mockDeep } from 'vitest-mock-extended'

// Define a simplified mock type to avoid Prisma's circular type references (TS2615)
// This is a known issue with Prisma 7.x and vitest-mock-extended
// See: https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = ReturnType<typeof vi.fn> & ((...args: any[]) => any)

type MockModel = {
  findMany: MockFn
  findUnique: MockFn
  findFirst: MockFn
  create: MockFn
  createMany: MockFn
  update: MockFn
  updateMany: MockFn
  delete: MockFn
  deleteMany: MockFn
  upsert: MockFn
  count: MockFn
  aggregate: MockFn
  groupBy: MockFn
}

export type MockPrismaClient = {
  // All model names as dynamic keys returning MockModel
  user: MockModel
  role: MockModel
  permission: MockModel
  pelanggan: MockModel
  invoice: MockModel
  payment: MockModel
  paket: MockModel
  bandwidth: MockModel
  mikrotikRouter: MockModel
  attendance: MockModel
  leave: MockModel
  workOrders: MockModel
  supportTickets: MockModel
  ticketReplies: MockModel
  inventory: MockModel
  site: MockModel
  department: MockModel
  notifications: MockModel
  announcement: MockModel
  leaveBalance: MockModel
  overtime: MockModel
  shift: MockModel
  holiday: MockModel
  salary: MockModel
  salaryComponent: MockModel
  canvasing: MockModel
  pointClaim: MockModel
  coupon: MockModel
  purchaseOrder: MockModel
  purchaseRequest: MockModel
  supplier: MockModel
  odc: MockModel
  odcOutput: MockModel
  odp: MockModel
  odpOutput: MockModel
  onu: MockModel
  onuType: MockModel
  barang: MockModel
  gudang: MockModel
  stokBarang: MockModel
  barangGudang: MockModel
  barangMasuk: MockModel
  barangKeluar: MockModel
  transferBarang: MockModel
  stockOpname: MockModel
  asset: MockModel
  speedProfile: MockModel
  profilePpp: MockModel
  hargaPaket: MockModel
  registration: MockModel
  systemLog: MockModel
  loginLog: MockModel
  appVersion: MockModel
  settings: MockModel
  locationHistory: MockModel
  workOrderTasks: MockModel
  workOrderAssignments: MockModel
  workOrderUpdates: MockModel
  workOrderComment: MockModel
  workOrderAttachment: MockModel
  workOrderMaterial: MockModel
  workOrderTemplate: MockModel
  workOrderSla: MockModel
  workOrderEscalation: MockModel
  chatMessage: MockModel
  conversation: MockModel
  pushToken: MockModel
  // Prisma client methods
  $connect: MockFn
  $disconnect: MockFn
  $transaction: MockFn
  $queryRaw: MockFn
  $executeRaw: MockFn
  // Allow any other model access
  [key: string]: MockModel | MockFn
}

// Create deep mock without explicit PrismaClient type to avoid circular reference
const createMock = () => {
  // Import PrismaClient dynamically to avoid type issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client')
  return mockDeep(new PrismaClient())
}

// Export with simplified type - the actual mock still has all Prisma methods
export const prismaMock = createMock() as unknown as MockPrismaClient

// Mock the prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}))

// Reset all mocks before each test
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockReset(prismaMock as any)
})

// Mock console methods to reduce noise in tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {})
// vi.spyOn(console, 'error').mockImplementation(() => {})
