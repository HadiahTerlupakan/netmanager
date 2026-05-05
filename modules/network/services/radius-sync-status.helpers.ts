import type { RadiusRepository } from "../repositories/RadiusRepository";
import type { NetworkRepository } from "../repositories/NetworkRepository";
import type { Status } from "../types/network.enums";
import type { MikroTikPPPSecretService } from "./MikroTikPPPSecretService";
import type { ConnectionMode } from "./radius-sync-service";

type StatusTransitionDependencies = {
  networkRepo: Pick<NetworkRepository, "findPelangganBasic">;
  radiusRepo: Pick<RadiusRepository, "syncPelangganToRadius">;
  pppSecretService: Pick<
    MikroTikPPPSecretService,
    | "syncNewCustomer"
    | "unIsolateCustomer"
    | "isolateCustomer"
    | "dismantleCustomer"
  >;
};

type VerifySyncDependencies = {
  networkRepo: Pick<NetworkRepository, "findPelangganBasic">;
  radiusRepo: Pick<RadiusRepository, "userExists">;
};

function isInactiveStatus(status: Status) {
  return status === "ISOLIR" || status === "NONAKTIF";
}

async function activateMikroTikCustomer(params: {
  pelangganId: string;
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}) {
  await params.pppSecretService.syncNewCustomer(params.pelangganId);
  await params.pppSecretService.unIsolateCustomer(params.pelangganId);
}

async function isolateMikroTikCustomer(params: {
  pelangganId: string;
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}) {
  await params.pppSecretService.isolateCustomer(params.pelangganId);
}

async function dismantleMikroTikCustomer(params: {
  pelangganId: string;
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}) {
  await params.pppSecretService.dismantleCustomer(params.pelangganId);
}

function isActiveStatus(status: Status) {
  return status === "AKTIF";
}

function isDismantleStatus(status: Status) {
  return status === "DISMANTLE";
}

async function syncMikroTikStatus(params: {
  pelangganId: string;
  newStatus: Status;
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}) {
  if (isActiveStatus(params.newStatus)) {
    return activateMikroTikCustomer(params);
  }

  if (isInactiveStatus(params.newStatus)) {
    return isolateMikroTikCustomer(params);
  }

  if (isDismantleStatus(params.newStatus)) {
    return dismantleMikroTikCustomer(params);
  }

  return isolateMikroTikCustomer(params);
}

async function syncRadiusStatus(params: {
  pelangganId: string;
  newStatus: Status;
  radiusRepo: StatusTransitionDependencies["radiusRepo"];
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}) {
  await params.radiusRepo.syncPelangganToRadius(params.pelangganId);

  if (params.newStatus === "AKTIF") {
    await params.pppSecretService.unIsolateCustomer(params.pelangganId);
    return;
  }

  if (params.newStatus === "DISMANTLE") {
    await params.pppSecretService.dismantleCustomer(params.pelangganId);
    return;
  }

  await params.pppSecretService.isolateCustomer(params.pelangganId);
}

async function ensurePelangganExists(params: {
  pelangganId: string;
  networkRepo: StatusTransitionDependencies["networkRepo"];
}) {
  const pelanggan = await params.networkRepo.findPelangganBasic(
    params.pelangganId,
  );

  if (!pelanggan) {
    throw new Error(`Pelanggan ${params.pelangganId} not found`);
  }
}

/** Tangani perubahan status pelanggan sesuai mode koneksi aktif. */
export async function handleCustomerStatusChange(params: {
  pelangganId: string;
  newStatus: Status;
  mode: ConnectionMode;
  networkRepo: StatusTransitionDependencies["networkRepo"];
  radiusRepo: StatusTransitionDependencies["radiusRepo"];
  pppSecretService: StatusTransitionDependencies["pppSecretService"];
}): Promise<void> {
  await ensurePelangganExists(params);

  if (params.mode === "MIKROTIK_API") {
    await syncMikroTikStatus(params);
    return;
  }

  await syncRadiusStatus(params);
}

async function getVerifiedPelanggan(params: {
  pelangganId: string;
  networkRepo: VerifySyncDependencies["networkRepo"];
}) {
  const pelanggan = await params.networkRepo.findPelangganBasic(
    params.pelangganId,
  );

  if (!pelanggan || !pelanggan.tenantId) {
    throw new Error(
      `Pelanggan ${params.pelangganId} not found or missing tenantId`,
    );
  }

  return pelanggan;
}

function createSyncVerificationResult(params: {
  username: string;
  status: Status;
  existsInRadius: boolean;
}) {
  return {
    synced: params.existsInRadius === (params.status === "AKTIF"),
    username: params.username,
    status: params.status,
    existsInRadius: params.existsInRadius,
  };
}

/** Verifikasi apakah data pelanggan sudah sinkron dengan tabel RADIUS. */
async function getRadiusUserExistence(params: {
  pelanggan: Awaited<ReturnType<typeof getVerifiedPelanggan>>;
  radiusRepo: VerifySyncDependencies["radiusRepo"];
}) {
  return params.radiusRepo.userExists(
    params.pelanggan.username,
    params.pelanggan.tenantId,
  );
}

function createVerifiedSyncResult(params: {
  pelanggan: Awaited<ReturnType<typeof getVerifiedPelanggan>>;
  existsInRadius: boolean;
}) {
  return createSyncVerificationResult({
    username: params.pelanggan.username,
    status: params.pelanggan.status as Status,
    existsInRadius: params.existsInRadius,
  });
}

export async function verifyCustomerSyncStatus(params: {
  pelangganId: string;
  networkRepo: VerifySyncDependencies["networkRepo"];
  radiusRepo: VerifySyncDependencies["radiusRepo"];
}): Promise<{
  synced: boolean;
  username: string;
  status: Status;
  existsInRadius: boolean;
}> {
  const pelanggan = await getVerifiedPelanggan(params);
  const existsInRadius = await getRadiusUserExistence({
    pelanggan,
    radiusRepo: params.radiusRepo,
  });

  return createVerifiedSyncResult({ pelanggan, existsInRadius });
}
