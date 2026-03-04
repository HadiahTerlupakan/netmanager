import { beforeEach, vi } from 'vitest'
import { mockReset, mockDeep } from 'vitest-mock-extended'

// Define a simplified mock type to avoid Prisma's circular type references (TS2615)
// This is a known issue with Prisma 7.x and vitest-mock-extended
// See: https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = any

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
  mitra: MockModel
  mitraWallet: MockModel
  mitraTransaction: MockModel
  withdrawRequest: MockModel
  leaveRequest: MockModel
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
  $queryRawUnsafe: MockFn
  $executeRaw: MockFn
  // Allow any other model access
  [key: string]: MockModel | MockFn
}

// Create deep mock without instantiating real PrismaClient
// This avoids needing DATABASE_URL for tests
const createMock = (): MockPrismaClient => {
  const createMockModel = (): MockModel => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  })

  return mockDeep<MockPrismaClient>({
    user: createMockModel(),
    role: createMockModel(),
    permission: createMockModel(),
    pelanggan: createMockModel(),
    invoice: createMockModel(),
    payment: createMockModel(),
    paket: createMockModel(),
    bandwidth: createMockModel(),
    mikrotikRouter: createMockModel(),
    attendance: createMockModel(),
    leave: createMockModel(),
    workOrders: createMockModel(),
    supportTickets: createMockModel(),
    ticketReplies: createMockModel(),
    inventory: createMockModel(),
    site: createMockModel(),
    department: createMockModel(),
    notifications: createMockModel(),
    announcement: createMockModel(),
    leaveBalance: createMockModel(),
    overtime: createMockModel(),
    shift: createMockModel(),
    holiday: createMockModel(),
    salary: createMockModel(),
    salaryComponent: createMockModel(),
    mitra: createMockModel(),
    mitraWallet: createMockModel(),
    mitraTransaction: createMockModel(),
    withdrawRequest: createMockModel(),
    leaveRequest: createMockModel(),
    canvasing: createMockModel(),
    pointClaim: createMockModel(),
    coupon: createMockModel(),
    purchaseOrder: createMockModel(),
    purchaseRequest: createMockModel(),
    supplier: createMockModel(),
    odc: createMockModel(),
    odcOutput: createMockModel(),
    odp: createMockModel(),
    odpOutput: createMockModel(),
    onu: createMockModel(),
    onuType: createMockModel(),
    barang: createMockModel(),
    gudang: createMockModel(),
    stokBarang: createMockModel(),
    barangGudang: createMockModel(),
    barangMasuk: createMockModel(),
    barangKeluar: createMockModel(),
    transferBarang: createMockModel(),
    stockOpname: createMockModel(),
    asset: createMockModel(),
    speedProfile: createMockModel(),
    profilePpp: createMockModel(),
    hargaPaket: createMockModel(),
    registration: createMockModel(),
    systemLog: createMockModel(),
    loginLog: createMockModel(),
    appVersion: createMockModel(),
    settings: createMockModel(),
    locationHistory: createMockModel(),
    workOrderTasks: createMockModel(),
    workOrderAssignments: createMockModel(),
    workOrderUpdates: createMockModel(),
    workOrderComment: createMockModel(),
    workOrderAttachment: createMockModel(),
    workOrderMaterial: createMockModel(),
    workOrderTemplate: createMockModel(),
    workOrderSla: createMockModel(),
    workOrderEscalation: createMockModel(),
    chatMessage: createMockModel(),
    conversation: createMockModel(),
    pushToken: createMockModel(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
  })
}

// Export with simplified type - the actual mock still has all Prisma methods
export const prismaMock = createMock() as unknown as MockPrismaClient

// Mock the prisma modules
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}))

vi.mock('@/lib/prisma-mitra', () => ({
  prismaMitra: prismaMock
}))

// Reset all mocks before each test
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockReset(prismaMock as any)
})

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => { })
vi.spyOn(console, 'error').mockImplementation(() => { })

// Mock the WebSocket emitter globally using vi.mock
// This replaces the module completely preventing any network calls
vi.mock('@/lib/websocket/emitter', () => ({
  socketEmitter: {
    notifyUser: vi.fn(),
    notifyDepartment: vi.fn(),
    notifyAdmins: vi.fn(),
    updateNotificationCount: vi.fn(),
    newTicket: vi.fn(),
    updateTicket: vi.fn(),
    ticketReply: vi.fn(),
    ticketMessage: vi.fn(),
    updateTicketCount: vi.fn(),
    newWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    workOrderAssigned: vi.fn(),
    workOrderActivity: vi.fn(),
    inventoryUpdate: vi.fn(),
    broadcast: vi.fn(),
    forceLogout: vi.fn(),
  }
}))
