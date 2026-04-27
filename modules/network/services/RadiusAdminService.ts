import { logActivitySafe } from "@/lib/logger";
import type {
  NasEntity,
  RadIpPoolEntity,
} from "../domain/entities/RadiusEntity";
import type { IRadiusRepository } from "../domain/ports/IRadiusRepository";
import { RadiusRepository } from "../repositories/RadiusRepository";

const DEFAULT_NAS_TYPE = "other";
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export class RadiusAdminServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RadiusAdminServiceError";
  }
}

export interface RadiusSessionQuery {
  tenantId: string;
  username?: string;
}

export interface RadiusNasPayload {
  nasname?: string;
  shortname?: string;
  type?: string;
  ports?: number;
  secret?: string;
  community?: string;
  description?: string;
}

export interface CreateNasInput {
  tenantId: string;
  userId: string;
  payload: RadiusNasPayload;
}

export interface UpdateNasInput {
  id: number;
  tenantId: string;
  payload: RadiusNasPayload;
}

export interface RadiusIpPoolQuery {
  tenantId: string;
  poolName?: string;
  getStats: boolean;
}

export interface CreateIpPoolInput {
  tenantId: string;
  userId: string;
  poolName?: string;
  framedIpAddress?: string;
}

export interface DeleteIpPoolInput {
  tenantId: string;
  ipAddress: string;
}

export class RadiusAdminService {
  constructor(
    private readonly repository: IRadiusRepository = new RadiusRepository(),
  ) {}

  /** Get active RADIUS sessions for one tenant. */
  async getActiveSessions(query: RadiusSessionQuery) {
    const sessions = await this.repository.getActiveSessions(
      query.tenantId,
      query.username,
    );

    return { count: sessions.length, sessions };
  }

  /** Get all NAS entries for one tenant. */
  async getNasList(tenantId: string) {
    const data = await this.repository.getAllNas(tenantId);
    return { data, count: data.length };
  }

  /** Get one NAS by numeric id. */
  async getNasById(id: number, tenantId: string) {
    const nas = await this.repository.getNasById(id, tenantId);
    if (!nas) {
      throw createNotFoundError("NAS");
    }

    return nas;
  }

  /** Create one NAS entry after validation. */
  async createNas(input: CreateNasInput) {
    const payload = validateNasCreation(input.payload);
    await ensureNasDoesNotExist(
      this.repository,
      payload.nasname,
      input.tenantId,
    );

    const createdNas = await this.repository.createNas(payload, input.tenantId);
    logNasCreated(input.userId, createdNas);
    return createdNas;
  }

  /** Update one NAS entry after validation. */
  async updateNas(input: UpdateNasInput) {
    const existingNas = await this.repository.getNasById(
      input.id,
      input.tenantId,
    );
    if (!existingNas) {
      throw createNotFoundError("NAS");
    }

    const payload = normalizeNasUpdate(input.payload);
    await validateNasConflict(
      this.repository,
      existingNas,
      payload,
      input.tenantId,
    );
    return this.repository.updateNas(input.id, payload, input.tenantId);
  }

  /** Delete one NAS entry by id. */
  async deleteNas(id: number, tenantId: string) {
    await this.getNasById(id, tenantId);
    await this.repository.deleteNas(id, tenantId);
  }

  /** Get IP pool data or summary stats. */
  async getIpPools(query: RadiusIpPoolQuery) {
    if (query.getStats) {
      const data = await this.repository.getIpPoolStats(
        query.tenantId,
        query.poolName,
      );

      return { data, poolName: query.poolName || "all" };
    }

    const pools = await this.repository.getAllIpPools(query.tenantId);
    const data = filterPoolsByName(pools, query.poolName);
    return { data, count: data.length, poolName: query.poolName || "all" };
  }

  /** Add one IP address into a pool. */
  async addIpPool(input: CreateIpPoolInput) {
    const pool = validateIpPoolCreation(input);
    const createdPool = await this.repository.addToIpPool(pool, input.tenantId);
    logIpPoolCreated(input.userId, createdPool);
    return createdPool;
  }

  /** Remove one IP address from the pool. */
  async removeIpPool(input: DeleteIpPoolInput) {
    validateIpv4(input.ipAddress, "Format alamat IP tidak valid");
    await this.repository.removeFromIpPool(input.ipAddress, input.tenantId);
    return { ipAddress: input.ipAddress };
  }
}

function filterPoolsByName(pools: RadIpPoolEntity[], poolName?: string) {
  if (!poolName) {
    return pools;
  }

  return pools.filter((pool) => pool.poolName === poolName);
}

function validateNasCreation(payload: RadiusNasPayload): NasEntity {
  if (!payload.nasname || !payload.secret) {
    throw createValidationError("NAS name dan secret wajib diisi");
  }

  return {
    nasname: payload.nasname,
    secret: payload.secret,
    shortname: payload.shortname,
    type: payload.type || DEFAULT_NAS_TYPE,
    ports: payload.ports,
    community: payload.community,
    description: payload.description,
  };
}

function normalizeNasUpdate(payload: RadiusNasPayload): Partial<NasEntity> {
  return {
    ...(payload.nasname !== undefined ? { nasname: payload.nasname } : {}),
    ...(payload.shortname !== undefined
      ? { shortname: payload.shortname }
      : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.ports !== undefined ? { ports: payload.ports } : {}),
    ...(payload.secret !== undefined ? { secret: payload.secret } : {}),
    ...(payload.community !== undefined
      ? { community: payload.community }
      : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
  };
}

async function ensureNasDoesNotExist(
  repository: IRadiusRepository,
  nasname: string,
  tenantId: string,
) {
  const existingNas = await repository.getNasByIp(nasname, tenantId);
  if (existingNas) {
    throw createConflictError("NAS dengan IP/hostname ini sudah ada");
  }
}

async function validateNasConflict(
  repository: IRadiusRepository,
  existingNas: NasEntity,
  payload: Partial<NasEntity>,
  tenantId: string,
) {
  if (!payload.nasname || payload.nasname === existingNas.nasname) {
    return;
  }

  await ensureNasDoesNotExist(repository, payload.nasname, tenantId);
}

function validateIpPoolCreation(input: CreateIpPoolInput): RadIpPoolEntity {
  if (!input.poolName || !input.framedIpAddress) {
    throw createValidationError("Pool name dan framed IP address wajib diisi");
  }

  validateIpv4(input.framedIpAddress, "Format alamat IP tidak valid");
  return { poolName: input.poolName, framedIpAddress: input.framedIpAddress };
}

function validateIpv4(ipAddress: string, message: string) {
  if (!IPV4_REGEX.test(ipAddress)) {
    throw createValidationError(message);
  }
}

function logNasCreated(userId: string, nas: NasEntity) {
  logActivitySafe({
    action: "CREATE",
    subject: "NAS",
    userId,
    details: { id: nas.id, nasname: nas.nasname, shortname: nas.shortname },
  });
}

function logIpPoolCreated(userId: string, pool: RadIpPoolEntity) {
  logActivitySafe({
    action: "CREATE",
    subject: "IP Pool",
    userId,
    details: {
      id: pool.id,
      poolName: pool.poolName,
      ip: pool.framedIpAddress,
    },
  });
}

function createValidationError(message: string) {
  return new RadiusAdminServiceError(message, 400, "VALIDATION_ERROR");
}

function createConflictError(message: string) {
  return new RadiusAdminServiceError(message, 409, "CONFLICT");
}

function createNotFoundError(resource: string) {
  return new RadiusAdminServiceError(
    `${resource} tidak ditemukan`,
    404,
    "NOT_FOUND",
  );
}
