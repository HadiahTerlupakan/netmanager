-- CreateEnum
CREATE TYPE "VlanPurpose" AS ENUM ('INTERNET', 'IPTV', 'VOIP', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "OltAlertType" AS ENUM ('LOS', 'LOW_POWER', 'OFFLINE', 'CRITICAL_POWER');

-- CreateEnum
CREATE TYPE "OltAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "olt_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "snmpCommunity" TEXT,
    "snmpPort" INTEGER DEFAULT 161,
    "telnetPort" INTEGER DEFAULT 23,
    "telnetUser" TEXT,
    "telnetPass" TEXT,
    "totalPonPorts" INTEGER NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onu_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "pelangganId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "ponPort" INTEGER NOT NULL,
    "onuIndex" INTEGER NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "rxPower" DOUBLE PRECISION,
    "txPower" DOUBLE PRECISION,
    "vlanId" INTEGER,
    "bandwidthProfile" TEXT,
    "lastSeen" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onu_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olt_vlan_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "ponPort" INTEGER,
    "vlanId" INTEGER NOT NULL,
    "vlanName" TEXT,
    "purpose" "VlanPurpose" NOT NULL DEFAULT 'INTERNET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "olt_vlan_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olt_command_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "onuId" TEXT,
    "command" TEXT NOT NULL,
    "params" JSONB,
    "result" TEXT NOT NULL,
    "errorMsg" TEXT,
    "executedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "olt_command_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onu_pre_registrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "oltId" TEXT,
    "pelangganId" TEXT,
    "bandwidthProfile" TEXT,
    "vlanId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onu_pre_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olt_bandwidth_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploadRate" INTEGER NOT NULL,
    "downloadRate" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_bandwidth_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onu_power_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "onuId" TEXT NOT NULL,
    "rxPower" DOUBLE PRECISION,
    "txPower" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onu_power_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olt_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "onuId" TEXT,
    "type" "OltAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "OltAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "olt_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "olt_devices_tenantId_idx" ON "olt_devices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "onu_devices_serialNumber_key" ON "onu_devices"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "onu_devices_oltId_ponPort_onuIndex_key" ON "onu_devices"("oltId", "ponPort", "onuIndex");

-- CreateIndex
CREATE INDEX "onu_devices_tenantId_idx" ON "onu_devices"("tenantId");

-- CreateIndex
CREATE INDEX "onu_devices_oltId_idx" ON "onu_devices"("oltId");

-- CreateIndex
CREATE INDEX "onu_devices_status_idx" ON "onu_devices"("status");

-- CreateIndex
CREATE INDEX "olt_vlan_configs_oltId_idx" ON "olt_vlan_configs"("oltId");

-- CreateIndex
CREATE INDEX "olt_command_logs_tenantId_createdAt_idx" ON "olt_command_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "olt_command_logs_oltId_idx" ON "olt_command_logs"("oltId");

-- CreateIndex
CREATE UNIQUE INDEX "onu_pre_registrations_serialNumber_key" ON "onu_pre_registrations"("serialNumber");

-- CreateIndex
CREATE INDEX "onu_pre_registrations_tenantId_status_idx" ON "onu_pre_registrations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "olt_bandwidth_profiles_tenantId_idx" ON "olt_bandwidth_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "olt_bandwidth_profiles_oltId_idx" ON "olt_bandwidth_profiles"("oltId");

-- CreateIndex
CREATE INDEX "onu_power_history_onuId_recordedAt_idx" ON "onu_power_history"("onuId", "recordedAt");

-- CreateIndex
CREATE INDEX "onu_power_history_tenantId_recordedAt_idx" ON "onu_power_history"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "olt_alerts_tenantId_isRead_createdAt_idx" ON "olt_alerts"("tenantId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "olt_alerts_oltId_idx" ON "olt_alerts"("oltId");

-- CreateIndex
CREATE INDEX "olt_alerts_onuId_idx" ON "olt_alerts"("onuId");

-- AddForeignKey
ALTER TABLE "onu_devices" ADD CONSTRAINT "onu_devices_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onu_devices" ADD CONSTRAINT "onu_devices_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_vlan_configs" ADD CONSTRAINT "olt_vlan_configs_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_command_logs" ADD CONSTRAINT "olt_command_logs_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_bandwidth_profiles" ADD CONSTRAINT "olt_bandwidth_profiles_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onu_power_history" ADD CONSTRAINT "onu_power_history_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "onu_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_alerts" ADD CONSTRAINT "olt_alerts_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_alerts" ADD CONSTRAINT "olt_alerts_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "onu_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
