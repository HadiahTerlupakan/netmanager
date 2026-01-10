-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('RESTOCK_NEEDED', 'STOCK_OUT', 'LOW_STOCK', 'OVERSTOCK', 'EXPIRED_WARNING');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "DurasiUnit" AS ENUM ('JAM', 'HARI', 'BULAN', 'TAHUN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'OVERDUE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('SERVICE', 'PRODUCT', 'SETUP_FEE', 'MONTHLY_FEE', 'ONE_TIME_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "KondisiBarang" AS ENUM ('BARU', 'BEKAS', 'RUSAK');

-- CreateEnum

-- CreateEnum

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('AUTH', 'ACTIVITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'E_WALLET', 'CREDIT_CARD', 'DEBIT_CARD', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'SURVEYED', 'INSTALLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RestoreStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('AKTIF', 'NONAKTIF', 'MAINTENANCE', 'ISOLIR', 'DISMANTLE');

-- CreateEnum
CREATE TYPE "TargetAudience" AS ENUM ('ALL', 'CUSTOMER', 'EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'BILLING', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TipePelanggan" AS ENUM ('REGULER', 'NON_REGULER');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkingHourMode" AS ENUM ('FIXED', 'SHIFT', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "ARAgingSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current" BIGINT NOT NULL DEFAULT 0,
    "overdue30" BIGINT NOT NULL DEFAULT 0,
    "overdue60" BIGINT NOT NULL DEFAULT 0,
    "overdue90" BIGINT NOT NULL DEFAULT 0,
    "totalOutstanding" BIGINT NOT NULL DEFAULT 0,
    "totalCustomers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ARAgingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "target" "TargetAudience" NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT,
    "pelangganId" TEXT,
    "portal" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" TIMESTAMP(3),
    "checkInPhoto" TEXT,
    "checkOutPhoto" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkOutLocation" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable
CREATE TABLE "Bandwidth" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxLimitDownload" TEXT NOT NULL,
    "maxLimitUpload" TEXT NOT NULL,
    "burstLimitDownload" TEXT,
    "burstLimitUpload" TEXT,
    "minLimitDownload" TEXT,
    "minLimitUpload" TEXT,
    "burstThresholdDownload" TEXT,
    "burstThresholdUpload" TEXT,
    "burstTimeDownload" INTEGER,
    "burstTimeUpload" INTEGER,
    "priority" INTEGER,
    "uploadSpeed" INTEGER,
    "downloadSpeed" INTEGER,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bandwidth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "minTransaction" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "quota" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUsage" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT,
    "pelangganId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCohort" (
    "id" TEXT NOT NULL,
    "cohortMonth" INTEGER NOT NULL,
    "cohortYear" INTEGER NOT NULL,
    "initialCustomers" INTEGER NOT NULL,
    "month0Revenue" BIGINT NOT NULL DEFAULT 0,
    "month1Revenue" BIGINT NOT NULL DEFAULT 0,
    "month2Revenue" BIGINT NOT NULL DEFAULT 0,
    "month3Revenue" BIGINT NOT NULL DEFAULT 0,
    "month6Revenue" BIGINT NOT NULL DEFAULT 0,
    "month12Revenue" BIGINT NOT NULL DEFAULT 0,
    "activeMonth0" INTEGER NOT NULL DEFAULT 0,
    "activeMonth1" INTEGER NOT NULL DEFAULT 0,
    "activeMonth3" INTEGER NOT NULL DEFAULT 0,
    "activeMonth6" INTEGER NOT NULL DEFAULT 0,
    "activeMonth12" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HargaPaket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bandwidthId" TEXT,
    "profilePPPId" TEXT NOT NULL,
    "harga" INTEGER NOT NULL,
    "durasi" INTEGER NOT NULL DEFAULT 30,
    "durasiUnit" "DurasiUnit" NOT NULL DEFAULT 'HARI',
    "usePPN" BOOLEAN NOT NULL DEFAULT false,
    "ppnPercentage" DOUBLE PRECISION,
    "useDiscount" BOOLEAN NOT NULL DEFAULT false,
    "discountType" "DiscountType",
    "discountValue" DOUBLE PRECISION,
    "discountDuration" INTEGER,
    "discountDurationUnit" "DurasiUnit",
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HargaPaket_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "taxAmount" BIGINT NOT NULL DEFAULT 0,
    "discountAmount" BIGINT NOT NULL DEFAULT 0,
    "totalAmount" BIGINT NOT NULL DEFAULT 0,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" BIGINT NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'SERVICE',

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Joinbox" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "keteranganJumlahKabelFeeder" TEXT,

    CONSTRAINT "Joinbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinboxInput" (
    "id" TEXT NOT NULL,
    "joinboxId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "inputUnit" TEXT NOT NULL,
    "portUnit" TEXT NOT NULL,
    "tubeColor" TEXT NOT NULL,
    "coreColor" TEXT NOT NULL,

    CONSTRAINT "JoinboxInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinboxOutput" (
    "id" TEXT NOT NULL,
    "joinboxId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "inputUnit" TEXT NOT NULL,
    "portUnit" TEXT NOT NULL,
    "tubeColor" TEXT NOT NULL,
    "coreColor" TEXT NOT NULL,

    CONSTRAINT "JoinboxOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KmzFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "lineColor" TEXT NOT NULL DEFAULT '#3388ff',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kmlPath" TEXT NOT NULL,

    CONSTRAINT "KmzFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable
CREATE TABLE "MRRMovement" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "movementType" TEXT NOT NULL,
    "pelangganId" TEXT,
    "amount" BIGINT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MRRMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MikroTikRouter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT '+07:00 Asia/Jakarta',
    "apiPort" INTEGER NOT NULL DEFAULT 8728,
    "apiUsername" TEXT NOT NULL,
    "apiPassword" TEXT NOT NULL,
    "apiUsernameGenerated" TEXT,
    "apiPasswordGenerated" TEXT,
    "authPort" INTEGER NOT NULL DEFAULT 7265,
    "accountingPort" INTEGER NOT NULL DEFAULT 7266,
    "secretRadius" TEXT NOT NULL,
    "isolirUrl" TEXT,
    "description" TEXT,
    "pingStatus" TEXT NOT NULL DEFAULT 'offline',
    "userOnline" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCheck" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MikroTikRouter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Odc" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "otbCoreId" TEXT NOT NULL,
    "keteranganJumlahKabelFeeder" TEXT,

    CONSTRAINT "Odc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdcOutput" (
    "id" TEXT NOT NULL,
    "odcId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "slotName" TEXT NOT NULL,
    "redaman" DOUBLE PRECISION,
    "tubeColor" TEXT NOT NULL,
    "coreColor" TEXT NOT NULL,

    CONSTRAINT "OdcOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Odp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "odcOutputId" TEXT NOT NULL,
    "keteranganJumlahKabelFeeder" TEXT,

    CONSTRAINT "Odp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdpOutput" (
    "id" TEXT NOT NULL,
    "odpId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "slotName" TEXT NOT NULL,
    "redaman" DOUBLE PRECISION,
    "tubeColor" TEXT NOT NULL,
    "coreColor" TEXT NOT NULL,

    CONSTRAINT "OdpOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Olt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT,
    "temperature" INTEGER,
    "connectedDevices" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "uptime" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT '0',
    "syncDate" TIMESTAMP(3),
    "telnetConnected" BOOLEAN NOT NULL DEFAULT false,
    "snmpConnected" BOOLEAN NOT NULL DEFAULT false,
    "snmpCommunityWrite" TEXT NOT NULL DEFAULT 'public',
    "snmpVersion" TEXT NOT NULL DEFAULT '2',
    "snmpPort" INTEGER NOT NULL DEFAULT 161,
    "telnetUsername" TEXT NOT NULL DEFAULT 'zte',
    "telnetPassword" TEXT NOT NULL,
    "telnetPort" INTEGER NOT NULL DEFAULT 23,
    "onuLastSync" TIMESTAMP(3),
    "onuSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Onu" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pppoe" TEXT,
    "gponOnu" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rxOlt" TEXT,
    "rxOnu" TEXT,
    "serialNumber" TEXT,
    "actualType" TEXT,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authMode" TEXT,
    "batteryStatus" TEXT,
    "configState" TEXT,
    "distance" DOUBLE PRECISION,
    "dyingGaspTime" TIMESTAMP(3),
    "equipmentId" TEXT,
    "firmwareVersion" TEXT,
    "hardwareVersion" TEXT,
    "laserBiasCurrent" DOUBLE PRECISION,
    "lastDeregTime" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "loid" TEXT,
    "macAddress" TEXT,
    "opticalTransceiverType" TEXT,
    "password" TEXT,
    "powerLevel" TEXT,
    "registerTime" TIMESTAMP(3),
    "registrationMode" TEXT,
    "rxBytes" BIGINT,
    "rxDrops" BIGINT,
    "rxErrors" BIGINT,
    "rxPackets" BIGINT,
    "rxPowerStatus" TEXT,
    "softwareVersion" TEXT,
    "temperature" DOUBLE PRECISION,
    "txBytes" BIGINT,
    "txDrops" BIGINT,
    "txErrors" BIGINT,
    "txOlt" TEXT,
    "txOnu" TEXT,
    "txPackets" BIGINT,
    "txPowerStatus" TEXT,
    "vendorId" TEXT,
    "wifiChannel" INTEGER,
    "wifiEnable" BOOLEAN,
    "wifiSecurityMode" TEXT,
    "wifiSsid" TEXT,
    "compositeIndex" INTEGER,
    "descOid" TEXT,
    "nameOid" TEXT,
    "rxOltOid" TEXT,
    "rxOnuOid" TEXT,
    "statusOid" TEXT,

    CONSTRAINT "Onu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnuType" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ethernetPorts" INTEGER NOT NULL DEFAULT 0,
    "wifi" INTEGER NOT NULL DEFAULT 0,
    "voipPorts" INTEGER NOT NULL DEFAULT 0,
    "ponType" TEXT,
    "description" TEXT,
    "maxTcont" INTEGER,
    "maxGemPort" INTEGER,
    "maxSwitchPerSlot" INTEGER,
    "maxFlowPerSwitch" INTEGER,
    "maxIpHost" INTEGER,
    "maxIpv6Host" INTEGER,
    "serviceAbilityN1" TEXT,
    "serviceAbility1M" TEXT,
    "serviceAbility1P" TEXT,
    "wifiMgmtViaNonOmci" TEXT,
    "omciSendMode" TEXT,
    "defaultMulticastRange" TEXT,
    "vrg" TEXT,
    "mgcConfigureMode" TEXT,
    "maxVeip" INTEGER,
    "extendedOmci" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnuType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otb" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "coreCount" INTEGER NOT NULL,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "keteranganJumlahKabelFeeder" TEXT,

    CONSTRAINT "Otb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtbCore" (
    "id" TEXT NOT NULL,
    "otbId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "slotName" TEXT NOT NULL,
    "tubeColor" TEXT NOT NULL,
    "coreColor" TEXT NOT NULL,

    CONSTRAINT "OtbCore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Overtime" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "duration" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endLocation" TEXT,
    "endPhoto" TEXT,
    "endTime" TIMESTAMP(3),
    "startLocation" TEXT,
    "startPhoto" TEXT,
    "startTime" TIMESTAMP(3),

    CONSTRAINT "Overtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "clientKey" TEXT,
    "merchantId" TEXT,
    "webhookUrl" TEXT,
    "callbackUrl" TEXT,
    "settings" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pelanggan" (
    "id" TEXT NOT NULL,
    "idPelanggan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "passwordLogin" TEXT NOT NULL,
    "hargaPaketId" TEXT NOT NULL,
    "tipe" "TipePelanggan" NOT NULL DEFAULT 'REGULER',
    "tanggalAktif" TIMESTAMP(3) NOT NULL,
    "jatuhTempo" TIMESTAMP(3) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "alamat" TEXT,
    "noTelp" TEXT,
    "email" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "biayaInstalasi" INTEGER,
    "biayaInstalasiDiskon" DOUBLE PRECISION,
    "biayaInstalasiIsRecurring" BOOLEAN NOT NULL DEFAULT false,
    "biayaLainnya" INTEGER,
    "biayaLainnyaDiskon" DOUBLE PRECISION,
    "biayaLainnyaIsRecurring" BOOLEAN NOT NULL DEFAULT false,
    "biayaSewaPerangkat" INTEGER,
    "biayaSewaPerangkatDiskon" DOUBLE PRECISION,
    "biayaSewaPerangkatIsRecurring" BOOLEAN NOT NULL DEFAULT true,
    "discountDuration" INTEGER,
    "discountDurationUnit" "DurasiUnit",
    "discountType" "DiscountType",
    "discountValue" DOUBLE PRECISION,
    "keteranganBiayaLainnya" TEXT,
    "useDiscount" BOOLEAN NOT NULL DEFAULT false,
    "usePPN" BOOLEAN NOT NULL DEFAULT true,
    "useProrate" BOOLEAN NOT NULL DEFAULT false,
    "jenisDokumen" TEXT,
    "noDokumen" TEXT,
    "fileBAST" TEXT,
    "fileKTP" TEXT,
    "fileRumahSekitar" TEXT,
    "kabupatenKota" TEXT,
    "kecamatan" TEXT,
    "kelurahanDesa" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "provinsi" TEXT,
    "odpId" TEXT,
    "passwordHash" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT,
    "is2FAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isBillNotifEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPromoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoIsolir" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "cableSlack" BOOLEAN NOT NULL DEFAULT false,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePPP" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "localAddress" TEXT NOT NULL,
    "remoteAddress" TEXT NOT NULL,
    "dnsServer" TEXT,
    "sessionTimeout" INTEGER,
    "idleTimeout" INTEGER,
    "mikroTikRouterId" TEXT,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePPP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'DAILY',
    "totalMRR" BIGINT NOT NULL DEFAULT 0,
    "totalARR" BIGINT NOT NULL DEFAULT 0,
    "newMRR" BIGINT NOT NULL DEFAULT 0,
    "expansionMRR" BIGINT NOT NULL DEFAULT 0,
    "contractionMRR" BIGINT NOT NULL DEFAULT 0,
    "churnMRR" BIGINT NOT NULL DEFAULT 0,
    "reactivationMRR" BIGINT NOT NULL DEFAULT 0,
    "activeCustomers" INTEGER NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "churnedCustomers" INTEGER NOT NULL DEFAULT 0,
    "arpu" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessAdminPanel" BOOLEAN NOT NULL DEFAULT false,
    "accessEmployeePanel" BOOLEAN NOT NULL DEFAULT false,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeedProfile" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "profileType" TEXT NOT NULL DEFAULT 'Download',
    "name" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "bandwidthSir" INTEGER NOT NULL,
    "burstPir" INTEGER NOT NULL,
    "fixed" INTEGER,
    "assured" INTEGER,
    "maximum" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "type" "LogType" NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable

-- CreateTable

-- CreateTable
CREATE TABLE "barang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isWorkOrderMaterial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barang_gudang" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "stok" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stokBaru" INTEGER NOT NULL DEFAULT 0,
    "stokBekas" INTEGER NOT NULL DEFAULT 0,
    "stokRusak" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "barang_gudang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barang_keluar" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "transferId" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlah" INTEGER NOT NULL,
    "kondisi" "KondisiBarang" NOT NULL DEFAULT 'BARU',
    "keterangan" TEXT,
    "lokasiPenyimpanan" TEXT,
    "nomorRak" TEXT,
    "nomorBox" TEXT,
    "pic" TEXT,
    "tujuanPenggunaan" TEXT,
    "nomorBatch" TEXT,
    "customer" TEXT,
    "isHilang" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotoBukti" TEXT[],
    "fotoMetadata" JSONB,
    "userId" TEXT,

    CONSTRAINT "barang_keluar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barang_masuk" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "transferId" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlah" INTEGER NOT NULL,
    "kondisi" "KondisiBarang" NOT NULL DEFAULT 'BARU',
    "keterangan" TEXT,
    "lokasiPenyimpanan" TEXT,
    "nomorRak" TEXT,
    "nomorBox" TEXT,
    "pic" TEXT,
    "suhuPenyimpanan" DOUBLE PRECISION,
    "kelembaban" DOUBLE PRECISION,
    "tanggalExpire" TIMESTAMP(3),
    "nomorBatch" TEXT,
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotoBukti" TEXT[],
    "fotoMetadata" JSONB,
    "userId" TEXT,

    CONSTRAINT "barang_masuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_restores" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "restoreName" TEXT NOT NULL,
    "description" TEXT,
    "restoreMethod" TEXT,
    "status" "RestoreStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "warningMessage" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rollbackData" JSONB,
    "createdBy" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuration_restores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_usage" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "session_id" TEXT,
    "session_start_time" TIMESTAMP(3) NOT NULL,
    "session_end_time" TIMESTAMP(3),
    "session_duration" BIGINT,
    "upload_bytes" BIGINT,
    "download_bytes" BIGINT,
    "total_bytes" BIGINT,
    "nas_ip_address" TEXT,
    "calling_station_id" TEXT,
    "called_station_id" TEXT,
    "terminate_cause" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jobDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_backups" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backupName" TEXT NOT NULL,
    "description" TEXT,
    "backupType" "BackupType" NOT NULL DEFAULT 'MANUAL',
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT,
    "compressionType" TEXT DEFAULT 'gzip',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "encryptionKey" TEXT,
    "backupMethod" TEXT,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "isAutoCleanup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gudang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "lokasi" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gudang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas" (
    "id" SERIAL NOT NULL,
    "nasname" TEXT NOT NULL,
    "shortname" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "ports" INTEGER,
    "secret" TEXT NOT NULL DEFAULT 'secret',
    "community" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_alerts" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "alertType" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "threshold" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "metricName" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "autoResolve" BOOLEAN NOT NULL DEFAULT false,
    "autoResolveTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_performance" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "uptime" BIGINT,
    "rxBytes" BIGINT,
    "txBytes" BIGINT,
    "rxPackets" BIGINT,
    "txPackets" BIGINT,
    "rxDrops" BIGINT,
    "txDrops" BIGINT,
    "rxErrors" BIGINT,
    "txErrors" BIGINT,
    "interfaceStatus" JSONB,
    "connectionCount" INTEGER,
    "bandwidthUsage" DOUBLE PRECISION,
    "signalStrength" DOUBLE PRECISION,
    "powerLevel" TEXT,
    "customMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tenantId" TEXT,
    "scope" TEXT,
    "redirectUri" TEXT,
    "settings" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "oauth_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "level" TEXT,
    "description" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radacct" (
    "radAcctId" BIGSERIAL NOT NULL,
    "acctSessionId" TEXT NOT NULL,
    "acctUniqueId" TEXT NOT NULL,
    "username" TEXT,
    "groupname" TEXT,
    "realm" TEXT,
    "nasIpAddress" TEXT NOT NULL,
    "nasPortId" TEXT,
    "nasPortType" TEXT,
    "acctStartTime" TIMESTAMP(3),
    "acctUpdateTime" TIMESTAMP(3),
    "acctStopTime" TIMESTAMP(3),
    "acctInterval" BIGINT,
    "acctSessionTime" BIGINT,
    "acctAuthentic" TEXT,
    "connectInfoStart" TEXT,
    "connectInfoStop" TEXT,
    "acctInputOctets" BIGINT,
    "acctOutputOctets" BIGINT,
    "calledStationId" TEXT,
    "callingStationId" TEXT,
    "acctTerminateCause" TEXT,
    "serviceType" TEXT,
    "framedProtocol" TEXT,
    "framedIpAddress" TEXT,
    "framedIpv6Address" TEXT,
    "framedIpv6Prefix" TEXT,
    "framedInterfaceId" TEXT,
    "delegatedIpv6Prefix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radAcctId")
);

-- CreateTable
CREATE TABLE "radcheck" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" VARCHAR(2) NOT NULL DEFAULT '==',
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupcheck" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" VARCHAR(2) NOT NULL DEFAULT '==',
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radgroupcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupreply" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" VARCHAR(2) NOT NULL DEFAULT '=',
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radgroupreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radippool" (
    "id" SERIAL NOT NULL,
    "pool_name" TEXT NOT NULL,
    "framedipaddress" INET NOT NULL,
    "nasipaddress" INET,
    "pool_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radippool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "pass" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "authDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radreply" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" VARCHAR(2) NOT NULL DEFAULT '=',
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radusergroup" (
    "username" TEXT NOT NULL,
    "groupname" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radusergroup_pkey" PRIMARY KEY ("username","groupname")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "packageName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "ipAddress" TEXT,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restock_alerts" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL DEFAULT 'RESTOCK_NEEDED',
    "currentStok" INTEGER NOT NULL,
    "minStok" INTEGER NOT NULL,
    "recommendedOrder" INTEGER NOT NULL,
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restock_settings" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "minStok" INTEGER NOT NULL,
    "maxStok" INTEGER NOT NULL,
    "safetyStok" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "avgDailyUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsageCalculation" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_suspension" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "suspension_type" TEXT NOT NULL,
    "reason" TEXT,
    "suspended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspended_by" TEXT,
    "expected_resume_at" TIMESTAMP(3),
    "actual_resume_at" TIMESTAMP(3),
    "resumed_by" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attendanceRadius" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workOrderType" "WorkOrderType",
    "priority" "WorkOrderPriority",
    "departmentId" TEXT,
    "responseTime" INTEGER NOT NULL,
    "resolutionTime" INTEGER NOT NULL,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stokFisik" INTEGER NOT NULL,
    "stokSistem" INTEGER NOT NULL,
    "selisih" INTEGER NOT NULL,
    "keterangan" TEXT,
    "kondisiBaik" INTEGER NOT NULL DEFAULT 0,
    "kondisiRusak" INTEGER NOT NULL DEFAULT 0,
    "kondisiExpire" INTEGER NOT NULL DEFAULT 0,
    "lokasiPenyimpanan" TEXT,
    "nomorRak" TEXT,
    "nomorBox" TEXT,
    "pic" TEXT,
    "suhuPenyimpanan" DOUBLE PRECISION,
    "kelembaban" DOUBLE PRECISION,
    "tanggalExpire" TIMESTAMP(3),
    "nomorBatch" TEXT,
    "catatanDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_opname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_replies" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT,
    "pelangganId" TEXT,
    "isFromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_antar_gudang" (
    "id" TEXT NOT NULL,
    "kodeTransfer" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "dariGudangId" TEXT NOT NULL,
    "keGudangId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlah" INTEGER NOT NULL,
    "kondisi" "KondisiBarang" NOT NULL DEFAULT 'BARU',
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotoBukti" TEXT[],
    "fotoMetadata" JSONB,

    CONSTRAINT "transfer_antar_gudang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_analytics" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL DEFAULT 'DAILY',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalUsage" INTEGER NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "avgPerTransaction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_assignments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "role" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "userId" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "work_order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_escalations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slaId" TEXT,
    "workOrderType" "WorkOrderType",
    "priority" "WorkOrderPriority",
    "departmentId" TEXT,
    "triggerCondition" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL DEFAULT 1,
    "notifyRole" TEXT,
    "notifyUsers" TEXT[],
    "notifyDepartments" TEXT[],
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_tasks" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkOrderType" NOT NULL,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "departmentId" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION,
    "requiredMaterials" JSONB,
    "tasks" JSONB,
    "checklist" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_updates" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "oldStatus" "WorkOrderStatus",
    "newStatus" "WorkOrderStatus",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "pelangganId" TEXT,
    "type" "WorkOrderType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "departmentId" TEXT,
    "assignedToId" TEXT,
    "locationAddress" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "scheduledTimeStart" TEXT,
    "scheduledTimeEnd" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "requiredMaterials" JSONB,
    "usedMaterials" JSONB,
    "internalNotes" TEXT,
    "resolutionNotes" TEXT,
    "customerFeedback" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "disconnectionReason" TEXT,
    "siteId" TEXT,
    "slaId" TEXT,
    "templateId" TEXT,
    "ticketId" TEXT,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GudangToSite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GudangToSite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ARAgingSnapshot_snapshotDate_idx" ON "ARAgingSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX "Announcement_target_idx" ON "Announcement"("target");

-- CreateIndex
CREATE INDEX "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_pelangganId_idx" ON "AnnouncementRead"("pelangganId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_pelangganId_key" ON "AnnouncementRead"("announcementId", "pelangganId");

-- CreateIndex
CREATE INDEX "Attendance_checkIn_idx" ON "Attendance"("checkIn");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bandwidth_name_key" ON "Bandwidth"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_idx" ON "CouponUsage"("couponId");

-- CreateIndex
CREATE INDEX "CouponUsage_pelangganId_idx" ON "CouponUsage"("pelangganId");

-- CreateIndex
CREATE INDEX "CustomerCohort_cohortYear_cohortMonth_idx" ON "CustomerCohort"("cohortYear", "cohortMonth");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCohort_cohortYear_cohortMonth_key" ON "CustomerCohort"("cohortYear", "cohortMonth");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HargaPaket_name_key" ON "HargaPaket"("name");

-- CreateIndex
CREATE INDEX "HargaPaket_bandwidthId_idx" ON "HargaPaket"("bandwidthId");

-- CreateIndex
CREATE INDEX "HargaPaket_featured_idx" ON "HargaPaket"("featured");

-- CreateIndex
CREATE INDEX "HargaPaket_profilePPPId_idx" ON "HargaPaket"("profilePPPId");

-- CreateIndex
CREATE INDEX "HargaPaket_status_idx" ON "HargaPaket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "Invoice_pelangganId_idx" ON "Invoice"("pelangganId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "JoinboxInput_joinboxId_idx_key" ON "JoinboxInput"("joinboxId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "JoinboxOutput_joinboxId_idx_key" ON "JoinboxOutput"("joinboxId", "idx");

-- CreateIndex
CREATE INDEX "MRRMovement_movementType_idx" ON "MRRMovement"("movementType");

-- CreateIndex
CREATE INDEX "MRRMovement_pelangganId_idx" ON "MRRMovement"("pelangganId");

-- CreateIndex
CREATE INDEX "MRRMovement_year_month_idx" ON "MRRMovement"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MikroTikRouter_ipAddress_key" ON "MikroTikRouter"("ipAddress");

-- CreateIndex
CREATE INDEX "MikroTikRouter_pingStatus_idx" ON "MikroTikRouter"("pingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Odc_otbCoreId_key" ON "Odc"("otbCoreId");

-- CreateIndex
CREATE UNIQUE INDEX "OdcOutput_odcId_idx_key" ON "OdcOutput"("odcId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "Odp_odcOutputId_key" ON "Odp"("odcOutputId");

-- CreateIndex
CREATE UNIQUE INDEX "OdpOutput_odpId_idx_key" ON "OdpOutput"("odpId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "Olt_ipAddress_key" ON "Olt"("ipAddress");

-- CreateIndex
CREATE INDEX "Onu_lastSeen_idx" ON "Onu"("lastSeen");

-- CreateIndex
CREATE INDEX "Onu_lastUpdate_idx" ON "Onu"("lastUpdate");

-- CreateIndex
CREATE INDEX "Onu_macAddress_idx" ON "Onu"("macAddress");

-- CreateIndex
CREATE INDEX "Onu_oltId_gponOnu_idx" ON "Onu"("oltId", "gponOnu");

-- CreateIndex
CREATE INDEX "Onu_oltId_idx" ON "Onu"("oltId");

-- CreateIndex
CREATE INDEX "Onu_oltId_lastUpdate_idx" ON "Onu"("oltId", "lastUpdate");

-- CreateIndex
CREATE INDEX "Onu_oltId_status_idx" ON "Onu"("oltId", "status");

-- CreateIndex
CREATE INDEX "Onu_registerTime_idx" ON "Onu"("registerTime");

-- CreateIndex
CREATE INDEX "Onu_serialNumber_idx" ON "Onu"("serialNumber");

-- CreateIndex
CREATE INDEX "Onu_status_idx" ON "Onu"("status");

-- CreateIndex
CREATE INDEX "Onu_status_lastUpdate_idx" ON "Onu"("status", "lastUpdate");

-- CreateIndex
CREATE UNIQUE INDEX "Onu_oltId_gponOnu_key" ON "Onu"("oltId", "gponOnu");

-- CreateIndex
CREATE INDEX "OnuType_oltId_idx" ON "OnuType"("oltId");

-- CreateIndex
CREATE UNIQUE INDEX "OnuType_oltId_name_key" ON "OnuType"("oltId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OtbCore_otbId_idx_key" ON "OtbCore"("otbId", "idx");

-- CreateIndex
CREATE INDEX "Overtime_startTime_idx" ON "Overtime"("startTime");

-- CreateIndex
CREATE INDEX "Overtime_status_idx" ON "Overtime"("status");

-- CreateIndex
CREATE INDEX "Overtime_userId_idx" ON "Overtime"("userId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_pelangganId_idx" ON "Payment"("pelangganId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_provider_key" ON "PaymentGatewayConfig"("provider");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_isEnabled_idx" ON "PaymentGatewayConfig"("isEnabled");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_priority_idx" ON "PaymentGatewayConfig"("priority");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_provider_idx" ON "PaymentGatewayConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_idPelanggan_key" ON "Pelanggan"("idPelanggan");

-- CreateIndex
CREATE INDEX "Pelanggan_email_idx" ON "Pelanggan"("email");

-- CreateIndex
CREATE INDEX "Pelanggan_hargaPaketId_idx" ON "Pelanggan"("hargaPaketId");

-- CreateIndex
CREATE INDEX "Pelanggan_idPelanggan_idx" ON "Pelanggan"("idPelanggan");

-- CreateIndex
CREATE INDEX "Pelanggan_jatuhTempo_idx" ON "Pelanggan"("jatuhTempo");

-- CreateIndex
CREATE INDEX "Pelanggan_status_idx" ON "Pelanggan"("status");

-- CreateIndex
CREATE INDEX "Pelanggan_tanggalAktif_idx" ON "Pelanggan"("tanggalAktif");

-- CreateIndex
CREATE INDEX "Pelanggan_tipe_idx" ON "Pelanggan"("tipe");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePPP_name_key" ON "ProfilePPP"("name");

-- CreateIndex
CREATE INDEX "ProfilePPP_mikroTikRouterId_idx" ON "ProfilePPP"("mikroTikRouterId");

-- CreateIndex
CREATE INDEX "ReminderLog_createdAt_idx" ON "ReminderLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReminderLog_pelangganId_idx" ON "ReminderLog"("pelangganId");

-- CreateIndex
CREATE INDEX "ReminderLog_status_idx" ON "ReminderLog"("status");

-- CreateIndex
CREATE INDEX "RevenueSnapshot_snapshotDate_idx" ON "RevenueSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "RevenueSnapshot_snapshotType_idx" ON "RevenueSnapshot"("snapshotType");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueSnapshot_snapshotDate_snapshotType_key" ON "RevenueSnapshot"("snapshotDate", "snapshotType");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "Settings_key_idx" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "SpeedProfile_oltId_idx" ON "SpeedProfile"("oltId");

-- CreateIndex
CREATE INDEX "SpeedProfile_profileType_idx" ON "SpeedProfile"("profileType");

-- CreateIndex
CREATE UNIQUE INDEX "SpeedProfile_oltId_profileType_name_key" ON "SpeedProfile"("oltId", "profileType", "name");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_type_idx" ON "SystemLog"("type");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "barang_kode_key" ON "barang"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "barang_gudang_barangId_gudangId_key" ON "barang_gudang"("barangId", "gudangId");

-- CreateIndex
CREATE INDEX "barang_keluar_barangId_idx" ON "barang_keluar"("barangId");

-- CreateIndex
CREATE INDEX "barang_keluar_gudangId_idx" ON "barang_keluar"("gudangId");

-- CreateIndex
CREATE INDEX "barang_keluar_isHilang_idx" ON "barang_keluar"("isHilang");

-- CreateIndex
CREATE INDEX "barang_keluar_kondisi_idx" ON "barang_keluar"("kondisi");

-- CreateIndex
CREATE INDEX "barang_keluar_tanggal_idx" ON "barang_keluar"("tanggal");

-- CreateIndex
CREATE INDEX "barang_keluar_transferId_idx" ON "barang_keluar"("transferId");

-- CreateIndex
CREATE INDEX "barang_masuk_barangId_idx" ON "barang_masuk"("barangId");

-- CreateIndex
CREATE INDEX "barang_masuk_gudangId_idx" ON "barang_masuk"("gudangId");

-- CreateIndex
CREATE INDEX "barang_masuk_kondisi_idx" ON "barang_masuk"("kondisi");

-- CreateIndex
CREATE INDEX "barang_masuk_tanggal_idx" ON "barang_masuk"("tanggal");

-- CreateIndex
CREATE INDEX "barang_masuk_transferId_idx" ON "barang_masuk"("transferId");

-- CreateIndex
CREATE INDEX "configuration_restores_backupId_idx" ON "configuration_restores"("backupId");

-- CreateIndex
CREATE INDEX "configuration_restores_createdAt_idx" ON "configuration_restores"("createdAt");

-- CreateIndex
CREATE INDEX "configuration_restores_deviceId_deviceType_idx" ON "configuration_restores"("deviceId", "deviceType");

-- CreateIndex
CREATE INDEX "configuration_restores_scheduledAt_idx" ON "configuration_restores"("scheduledAt");

-- CreateIndex
CREATE INDEX "configuration_restores_status_idx" ON "configuration_restores"("status");

-- CreateIndex
CREATE INDEX "customer_usage_nas_ip_address_idx" ON "customer_usage"("nas_ip_address");

-- CreateIndex
CREATE INDEX "customer_usage_pelangganId_idx" ON "customer_usage"("pelangganId");

-- CreateIndex
CREATE INDEX "customer_usage_session_end_time_idx" ON "customer_usage"("session_end_time");

-- CreateIndex
CREATE INDEX "customer_usage_session_start_time_idx" ON "customer_usage"("session_start_time");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "device_backups_backupType_idx" ON "device_backups"("backupType");

-- CreateIndex
CREATE INDEX "device_backups_createdAt_idx" ON "device_backups"("createdAt");

-- CreateIndex
CREATE INDEX "device_backups_deviceId_deviceType_idx" ON "device_backups"("deviceId", "deviceType");

-- CreateIndex
CREATE INDEX "device_backups_scheduledAt_idx" ON "device_backups"("scheduledAt");

-- CreateIndex
CREATE INDEX "device_backups_status_idx" ON "device_backups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gudang_kode_key" ON "gudang"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "nas_nasname_key" ON "nas"("nasname");

-- CreateIndex
CREATE INDEX "network_alerts_alertType_idx" ON "network_alerts"("alertType");

-- CreateIndex
CREATE INDEX "network_alerts_createdAt_idx" ON "network_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "network_alerts_deviceId_deviceType_idx" ON "network_alerts"("deviceId", "deviceType");

-- CreateIndex
CREATE INDEX "network_alerts_isActive_idx" ON "network_alerts"("isActive");

-- CreateIndex
CREATE INDEX "network_alerts_severity_idx" ON "network_alerts"("severity");

-- CreateIndex
CREATE INDEX "network_alerts_status_idx" ON "network_alerts"("status");

-- CreateIndex
CREATE INDEX "network_performance_deviceId_deviceType_idx" ON "network_performance"("deviceId", "deviceType");

-- CreateIndex
CREATE INDEX "network_performance_deviceId_timestamp_idx" ON "network_performance"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "network_performance_deviceType_idx" ON "network_performance"("deviceType");

-- CreateIndex
CREATE INDEX "network_performance_timestamp_idx" ON "network_performance"("timestamp");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_departmentId_idx" ON "notifications"("departmentId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_provider_configs_provider_key" ON "oauth_provider_configs"("provider");

-- CreateIndex
CREATE INDEX "oauth_provider_configs_isEnabled_idx" ON "oauth_provider_configs"("isEnabled");

-- CreateIndex
CREATE INDEX "oauth_provider_configs_priority_idx" ON "oauth_provider_configs"("priority");

-- CreateIndex
CREATE INDEX "oauth_provider_configs_provider_idx" ON "oauth_provider_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "positions_title_key" ON "positions"("title");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_departmentId_idx" ON "positions"("departmentId");

-- CreateIndex
CREATE INDEX "positions_isActive_idx" ON "positions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_isActive_idx" ON "push_subscriptions"("isActive");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "radacct_acctUniqueId_key" ON "radacct"("acctUniqueId");

-- CreateIndex
CREATE INDEX "radacct_acctSessionId_idx" ON "radacct"("acctSessionId");

-- CreateIndex
CREATE INDEX "radacct_acctStartTime_idx" ON "radacct"("acctStartTime");

-- CreateIndex
CREATE INDEX "radacct_acctStopTime_idx" ON "radacct"("acctStopTime");

-- CreateIndex
CREATE INDEX "radacct_acctUniqueId_idx" ON "radacct"("acctUniqueId");

-- CreateIndex
CREATE INDEX "radacct_nasIpAddress_idx" ON "radacct"("nasIpAddress");

-- CreateIndex
CREATE INDEX "radacct_username_acctStartTime_idx" ON "radacct"("username", "acctStartTime");

-- CreateIndex
CREATE INDEX "radacct_username_idx" ON "radacct"("username");

-- CreateIndex
CREATE INDEX "radcheck_username_attribute_idx" ON "radcheck"("username", "attribute");

-- CreateIndex
CREATE INDEX "radcheck_username_idx" ON "radcheck"("username");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_attribute_idx" ON "radgroupcheck"("groupname", "attribute");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_idx" ON "radgroupcheck"("groupname");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_attribute_idx" ON "radgroupreply"("groupname", "attribute");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_idx" ON "radgroupreply"("groupname");

-- CreateIndex
CREATE UNIQUE INDEX "radippool_framedipaddress_key" ON "radippool"("framedipaddress");

-- CreateIndex
CREATE INDEX "radippool_nasipaddress_idx" ON "radippool"("nasipaddress");

-- CreateIndex
CREATE INDEX "radippool_pool_name_idx" ON "radippool"("pool_name");

-- CreateIndex
CREATE INDEX "radpostauth_authDate_idx" ON "radpostauth"("authDate");

-- CreateIndex
CREATE INDEX "radpostauth_username_idx" ON "radpostauth"("username");

-- CreateIndex
CREATE INDEX "radreply_username_attribute_idx" ON "radreply"("username", "attribute");

-- CreateIndex
CREATE INDEX "radreply_username_idx" ON "radreply"("username");

-- CreateIndex
CREATE INDEX "radusergroup_groupname_idx" ON "radusergroup"("groupname");

-- CreateIndex
CREATE INDEX "radusergroup_username_idx" ON "radusergroup"("username");

-- CreateIndex
CREATE INDEX "restock_alerts_alertType_idx" ON "restock_alerts"("alertType");

-- CreateIndex
CREATE INDEX "restock_alerts_barangId_idx" ON "restock_alerts"("barangId");

-- CreateIndex
CREATE INDEX "restock_alerts_createdAt_idx" ON "restock_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "restock_alerts_gudangId_idx" ON "restock_alerts"("gudangId");

-- CreateIndex
CREATE INDEX "restock_alerts_isRead_idx" ON "restock_alerts"("isRead");

-- CreateIndex
CREATE INDEX "restock_alerts_isResolved_idx" ON "restock_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "restock_settings_barangId_idx" ON "restock_settings"("barangId");

-- CreateIndex
CREATE INDEX "restock_settings_gudangId_idx" ON "restock_settings"("gudangId");

-- CreateIndex
CREATE INDEX "restock_settings_isActive_idx" ON "restock_settings"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "restock_settings_barangId_gudangId_key" ON "restock_settings"("barangId", "gudangId");

-- CreateIndex
CREATE INDEX "service_suspension_is_active_idx" ON "service_suspension"("is_active");

-- CreateIndex
CREATE INDEX "service_suspension_pelangganId_idx" ON "service_suspension"("pelangganId");

-- CreateIndex
CREATE INDEX "service_suspension_suspended_at_idx" ON "service_suspension"("suspended_at");

-- CreateIndex
CREATE INDEX "service_suspension_suspension_type_idx" ON "service_suspension"("suspension_type");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE INDEX "sites_isActive_idx" ON "sites"("isActive");

-- CreateIndex
CREATE INDEX "sla_departmentId_idx" ON "sla"("departmentId");

-- CreateIndex
CREATE INDEX "sla_isActive_idx" ON "sla"("isActive");

-- CreateIndex
CREATE INDEX "sla_priority_idx" ON "sla"("priority");

-- CreateIndex
CREATE INDEX "sla_workOrderType_idx" ON "sla"("workOrderType");

-- CreateIndex
CREATE INDEX "stock_opname_barangId_idx" ON "stock_opname"("barangId");

-- CreateIndex
CREATE INDEX "stock_opname_gudangId_idx" ON "stock_opname"("gudangId");

-- CreateIndex
CREATE INDEX "stock_opname_tanggal_idx" ON "stock_opname"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_pelangganId_idx" ON "support_tickets"("pelangganId");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_ticketNumber_idx" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "ticket_replies_createdAt_idx" ON "ticket_replies"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_replies_ticketId_idx" ON "ticket_replies"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_antar_gudang_kodeTransfer_key" ON "transfer_antar_gudang"("kodeTransfer");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_barangId_idx" ON "transfer_antar_gudang"("barangId");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_dariGudangId_idx" ON "transfer_antar_gudang"("dariGudangId");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_keGudangId_idx" ON "transfer_antar_gudang"("keGudangId");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_kondisi_idx" ON "transfer_antar_gudang"("kondisi");

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_tanggal_idx" ON "transfer_antar_gudang"("tanggal");

-- CreateIndex
CREATE INDEX "usage_analytics_barangId_idx" ON "usage_analytics"("barangId");

-- CreateIndex
CREATE INDEX "usage_analytics_gudangId_idx" ON "usage_analytics"("gudangId");

-- CreateIndex
CREATE INDEX "usage_analytics_periodStart_idx" ON "usage_analytics"("periodStart");

-- CreateIndex
CREATE INDEX "usage_analytics_periodType_idx" ON "usage_analytics"("periodType");

-- CreateIndex
CREATE UNIQUE INDEX "usage_analytics_barangId_gudangId_periodType_periodStart_key" ON "usage_analytics"("barangId", "gudangId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "work_order_assignments_userId_idx" ON "work_order_assignments"("userId");

-- CreateIndex
CREATE INDEX "work_order_assignments_workOrderId_idx" ON "work_order_assignments"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_attachments_uploadedAt_idx" ON "work_order_attachments"("uploadedAt");

-- CreateIndex
CREATE INDEX "work_order_attachments_workOrderId_idx" ON "work_order_attachments"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_escalations_departmentId_idx" ON "work_order_escalations"("departmentId");

-- CreateIndex
CREATE INDEX "work_order_escalations_escalationLevel_idx" ON "work_order_escalations"("escalationLevel");

-- CreateIndex
CREATE INDEX "work_order_escalations_isActive_idx" ON "work_order_escalations"("isActive");

-- CreateIndex
CREATE INDEX "work_order_escalations_priority_idx" ON "work_order_escalations"("priority");

-- CreateIndex
CREATE INDEX "work_order_escalations_slaId_idx" ON "work_order_escalations"("slaId");

-- CreateIndex
CREATE INDEX "work_order_escalations_workOrderType_idx" ON "work_order_escalations"("workOrderType");

-- CreateIndex
CREATE INDEX "work_order_tasks_status_idx" ON "work_order_tasks"("status");

-- CreateIndex
CREATE INDEX "work_order_tasks_workOrderId_idx" ON "work_order_tasks"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_templates_departmentId_idx" ON "work_order_templates"("departmentId");

-- CreateIndex
CREATE INDEX "work_order_templates_isActive_idx" ON "work_order_templates"("isActive");

-- CreateIndex
CREATE INDEX "work_order_templates_type_idx" ON "work_order_templates"("type");

-- CreateIndex
CREATE INDEX "work_order_updates_createdAt_idx" ON "work_order_updates"("createdAt");

-- CreateIndex
CREATE INDEX "work_order_updates_workOrderId_idx" ON "work_order_updates"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_workOrderNumber_key" ON "work_orders"("workOrderNumber");

-- CreateIndex
CREATE INDEX "work_orders_assignedToId_idx" ON "work_orders"("assignedToId");

-- CreateIndex
CREATE INDEX "work_orders_departmentId_idx" ON "work_orders"("departmentId");

-- CreateIndex
CREATE INDEX "work_orders_pelangganId_idx" ON "work_orders"("pelangganId");

-- CreateIndex
CREATE INDEX "work_orders_priority_idx" ON "work_orders"("priority");

-- CreateIndex
CREATE INDEX "work_orders_scheduledDate_idx" ON "work_orders"("scheduledDate");

-- CreateIndex
CREATE INDEX "work_orders_siteId_idx" ON "work_orders"("siteId");

-- CreateIndex
CREATE INDEX "work_orders_slaId_idx" ON "work_orders"("slaId");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_templateId_idx" ON "work_orders"("templateId");

-- CreateIndex
CREATE INDEX "work_orders_ticketId_idx" ON "work_orders"("ticketId");

-- CreateIndex
CREATE INDEX "work_orders_type_idx" ON "work_orders"("type");

-- CreateIndex
CREATE INDEX "work_orders_workOrderNumber_idx" ON "work_orders"("workOrderNumber");

-- CreateIndex
CREATE INDEX "Conversation_isGlobal_idx" ON "Conversation"("isGlobal");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- CreateIndex
CREATE INDEX "_GudangToSite_B_index" ON "_GudangToSite"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_bandwidthId_fkey" FOREIGN KEY ("bandwidthId") REFERENCES "Bandwidth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_profilePPPId_fkey" FOREIGN KEY ("profilePPPId") REFERENCES "ProfilePPP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxInput" ADD CONSTRAINT "JoinboxInput_joinboxId_fkey" FOREIGN KEY ("joinboxId") REFERENCES "Joinbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxOutput" ADD CONSTRAINT "JoinboxOutput_joinboxId_fkey" FOREIGN KEY ("joinboxId") REFERENCES "Joinbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_otbCoreId_fkey" FOREIGN KEY ("otbCoreId") REFERENCES "OtbCore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdcOutput" ADD CONSTRAINT "OdcOutput_odcId_fkey" FOREIGN KEY ("odcId") REFERENCES "Odc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_odcOutputId_fkey" FOREIGN KEY ("odcOutputId") REFERENCES "OdcOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdpOutput" ADD CONSTRAINT "OdpOutput_odpId_fkey" FOREIGN KEY ("odpId") REFERENCES "Odp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onu" ADD CONSTRAINT "Onu_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnuType" ADD CONSTRAINT "OnuType_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtbCore" ADD CONSTRAINT "OtbCore_otbId_fkey" FOREIGN KEY ("otbId") REFERENCES "Otb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_hargaPaketId_fkey" FOREIGN KEY ("hargaPaketId") REFERENCES "HargaPaket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_odpId_fkey" FOREIGN KEY ("odpId") REFERENCES "Odp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_mikroTikRouterId_fkey" FOREIGN KEY ("mikroTikRouterId") REFERENCES "MikroTikRouter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeedProfile" ADD CONSTRAINT "SpeedProfile_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_gudang" ADD CONSTRAINT "barang_gudang_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_gudang" ADD CONSTRAINT "barang_gudang_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfer_antar_gudang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfer_antar_gudang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restore_mikrotik_fkey" FOREIGN KEY ("deviceId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restore_olt_fkey" FOREIGN KEY ("deviceId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restore_onu_fkey" FOREIGN KEY ("deviceId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "device_backups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_usage" ADD CONSTRAINT "customer_usage_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alert_mikrotik_fkey" FOREIGN KEY ("deviceId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alert_olt_fkey" FOREIGN KEY ("deviceId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alert_onu_fkey" FOREIGN KEY ("deviceId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_mikrotik_fkey" FOREIGN KEY ("deviceId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_olt_fkey" FOREIGN KEY ("deviceId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_onu_fkey" FOREIGN KEY ("deviceId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_settings" ADD CONSTRAINT "restock_settings_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_settings" ADD CONSTRAINT "restock_settings_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_suspension" ADD CONSTRAINT "service_suspension_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla" ADD CONSTRAINT "sla_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla" ADD CONSTRAINT "sla_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_dariGudangId_fkey" FOREIGN KEY ("dariGudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_keGudangId_fkey" FOREIGN KEY ("keGudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_escalations" ADD CONSTRAINT "work_order_escalations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_escalations" ADD CONSTRAINT "work_order_escalations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_escalations" ADD CONSTRAINT "work_order_escalations_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "sla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "sla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "work_order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GudangToSite" ADD CONSTRAINT "_GudangToSite_A_fkey" FOREIGN KEY ("A") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GudangToSite" ADD CONSTRAINT "_GudangToSite_B_fkey" FOREIGN KEY ("B") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

