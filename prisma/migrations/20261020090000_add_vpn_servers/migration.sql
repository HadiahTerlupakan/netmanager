-- Versi RouterOS router, menentukan sintaks skrip yang dibuat.
CREATE TYPE "RouterOsVersion" AS ENUM ('V6', 'V7');

-- Cara netmanager menjangkau router: IP publik atau lewat tunnel VPN.
CREATE TYPE "RouterConnectionMode" AS ENUM ('PUBLIC', 'VPN');

-- Kolom VPN router. vpnActiveServerId tanpa FK: hanya cermin status core dan tidak boleh menghalangi penghapusan server.
ALTER TABLE "MikroTikRouter" ADD COLUMN     "connectionMode" "RouterConnectionMode" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "publicIpAddress" TEXT,
ADD COLUMN     "rosVersion" "RouterOsVersion" NOT NULL DEFAULT 'V6',
ADD COLUMN     "vpnActiveServerId" TEXT,
ADD COLUMN     "vpnAddress" TEXT,
ADD COLUMN     "vpnCoreRouterId" TEXT,
ADD COLUMN     "vpnScriptStale" BOOLEAN NOT NULL DEFAULT false;

-- Hub VPN milik core; id sama dengan id hub di core.
CREATE TABLE "vpn_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicHost" TEXT NOT NULL,
    "listenPort" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_install',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vpn_servers_pkey" PRIMARY KEY ("id")
);

-- Server VPN yang boleh dipakai tiap tenant.
CREATE TABLE "tenant_vpn_servers" (
    "tenantId" TEXT NOT NULL,
    "vpnServerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_vpn_servers_pkey" PRIMARY KEY ("tenantId","vpnServerId")
);

-- Server VPN tiap router, berurutan menurut priority.
CREATE TABLE "mikrotik_router_vpn_servers" (
    "routerId" TEXT NOT NULL,
    "vpnServerId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "mikrotik_router_vpn_servers_pkey" PRIMARY KEY ("routerId","vpnServerId")
);

-- Router core yang gagal dihapus, dicoba ulang oleh monitor.
CREATE TABLE "vpn_core_router_tombstones" (
    "coreRouterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vpn_core_router_tombstones_pkey" PRIMARY KEY ("coreRouterId")
);

-- Indeks untuk pencarian tenant/router berdasarkan server.
CREATE INDEX "tenant_vpn_servers_vpnServerId_idx" ON "tenant_vpn_servers"("vpnServerId");

-- Indeks pencarian router berdasarkan server.
CREATE INDEX "mikrotik_router_vpn_servers_vpnServerId_idx" ON "mikrotik_router_vpn_servers"("vpnServerId");

-- Satu id router core hanya boleh dipakai satu router.
CREATE UNIQUE INDEX "MikroTikRouter_vpnCoreRouterId_key" ON "MikroTikRouter"("vpnCoreRouterId");

-- Hapus tenant menghapus daftar servernya; server yang masih dipakai tidak bisa dihapus (RESTRICT).
ALTER TABLE "tenant_vpn_servers" ADD CONSTRAINT "tenant_vpn_servers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_vpn_servers" ADD CONSTRAINT "tenant_vpn_servers_vpnServerId_fkey" FOREIGN KEY ("vpnServerId") REFERENCES "vpn_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hapus router menghapus daftar servernya; server yang masih dipakai tidak bisa dihapus (RESTRICT).
ALTER TABLE "mikrotik_router_vpn_servers" ADD CONSTRAINT "mikrotik_router_vpn_servers_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mikrotik_router_vpn_servers" ADD CONSTRAINT "mikrotik_router_vpn_servers_vpnServerId_fkey" FOREIGN KEY ("vpnServerId") REFERENCES "vpn_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

