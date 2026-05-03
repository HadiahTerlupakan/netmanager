/** Abstract database client interface to avoid direct Prisma dependency in services. */
export type PrismaQueryArgs = Record<string, unknown>;
export type PrismaResult = Record<string, unknown>;
export type PrismaResultArray = PrismaResult[];

export interface DatabaseClient {
  permission: {
    findMany: (args: PrismaQueryArgs) => Promise<PrismaResultArray>;
    findFirst: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
    create: (args: PrismaQueryArgs) => Promise<PrismaResult>;
  };
  role: {
    findMany: (args: PrismaQueryArgs) => Promise<PrismaResultArray>;
    findFirst: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
    create: (args: PrismaQueryArgs) => Promise<PrismaResult>;
  };
  settings: {
    findMany: (args: PrismaQueryArgs) => Promise<PrismaResultArray>;
    findFirst: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
    create: (args: PrismaQueryArgs) => Promise<PrismaResult>;
  };
  user: {
    findUnique: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
    findFirst: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
  };
  workOrder: {
    findUnique: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
    findMany: (args: PrismaQueryArgs) => Promise<PrismaResultArray>;
    create: (args: PrismaQueryArgs) => Promise<PrismaResult>;
    update: (args: PrismaQueryArgs) => Promise<PrismaResult>;
  };
  department: {
    findFirst: (args: PrismaQueryArgs) => Promise<PrismaResult | null>;
  };
  $transaction: <T>(_queries: unknown[]) => Promise<T>;
}
