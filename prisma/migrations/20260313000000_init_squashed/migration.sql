-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MaterialReturnStatus" AS ENUM ('PENDING', 'VERIFIED', 'RETURNED_TO_WAREHOUSE', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('KARYAWAN');

-- CreateEnum
CREATE TYPE "PtkpStatus" AS ENUM ('TK_0', 'TK_1', 'TK_2', 'TK_3', 'K_0', 'K_1', 'K_2', 'K_3', 'KI_0', 'KI_1', 'KI_2', 'KI_3');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('FIXED', 'PER_HOUR', 'PERCENTAGE', 'DAILY_SALARY');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('DRAFT', 'CALCULATED', 'AUDITED', 'APPROVED', 'PAID', 'REVISED');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF', 'ALPHA');

-- CreateEnum
CREATE TYPE "AttendanceGeofencePolicy" AS ENUM ('STRICT', 'WARN', 'DISABLED');

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
CREATE TYPE "KondisiBarang" AS ENUM ('BARU', 'BEKAS', 'RUSAK');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SAKIT', 'CUTI', 'IZIN', 'LAINNYA', 'TUKAR_LIBUR');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('AUTH', 'ACTIVITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SURVEYED', 'INSTALLED', 'CANCELLED');

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
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED', 'REQUESTED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkingHourMode" AS ENUM ('FIXED', 'SHIFT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CanvasingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PointClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "JenisBarang" AS ENUM ('HABIS_PAKAI', 'ASET');

-- CreateEnum
CREATE TYPE "KategoriAset" AS ENUM ('ELEKTRONIK', 'KENDARAAN', 'FURNITURE', 'BANGUNAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INSTALLED', 'SOLD', 'DISPOSED', 'LOST', 'REPAIR');

-- CreateEnum
CREATE TYPE "RabPaymentType" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "RabRecoveryType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "RabExpenseType" AS ENUM ('CAPEX', 'OPEX');

-- CreateEnum
CREATE TYPE "RabRevisionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RabStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENGADAAN', 'PENGGELARAN_JARINGAN', 'PENJUALAN', 'TARGET_TERCAPAI', 'SELESAI');

-- CreateEnum
CREATE TYPE "RabItemCategory" AS ENUM ('HARDWARE', 'LICENSE', 'INSTALLATION', 'OTHER', 'DEVICE', 'CABLE', 'ACCESSORIES', 'SERVICE', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "RabGrowthType" AS ENUM ('LINEAR', 'PERCENTAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "TargetSchema" AS ENUM ('MONTHLY_RESET', 'ACCUMULATED');

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
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ON_TIME',
    "notes" TEXT,
    "location" TEXT,
    "checkOutLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "geofenceStatus" TEXT,
    "geofenceDistance" DOUBLE PRECISION,
    "geofenceSiteName" TEXT,
    "checkOutGeofenceStatus" TEXT,
    "checkOutGeofenceDistance" DOUBLE PRECISION,
    "geofenceMeta" JSONB,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "batteryLevel" DOUBLE PRECISION,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_locations_pkey" PRIMARY KEY ("id")
);

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
    "siteId" TEXT,

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
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
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
    "siteId" TEXT,
    "depreciation" BIGINT DEFAULT 0,
    "expenseCategoryId" TEXT,
    "mixRadiusGroupId" TEXT,
    "usefulLife" INTEGER DEFAULT 0,
    "accountId" TEXT,
    "categoryId" TEXT,
    "rabItemId" TEXT,
    "rabProjectId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceFile" TEXT,

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
    "siteId" TEXT,

    CONSTRAINT "HargaPaket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "passwordHash" TEXT,
    "namaLengkap" TEXT NOT NULL,
    "perusahaan" TEXT,
    "noTelp" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorPayout" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RabInvestor" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "investmentAmount" BIGINT NOT NULL DEFAULT 0,
    "profitSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RabInvestor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "isNational" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
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
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "siteId" TEXT,

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
    "siteId" TEXT,

    CONSTRAINT "KmzFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "replacementDate" TIMESTAMP(3),

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "quota" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

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
    "apiPasswordGenerated" TEXT,
    "apiUsernameGenerated" TEXT,
    "siteId" TEXT,

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
    "otbCoreId" TEXT,
    "keteranganJumlahKabelFeeder" TEXT,
    "siteId" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attenuationIn" DOUBLE PRECISION,
    "attenuationOut" DOUBLE PRECISION,
    "inputCoreColor" TEXT,

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
    "odcOutputId" TEXT,
    "keteranganJumlahKabelFeeder" TEXT,
    "siteId" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attenuationIn" DOUBLE PRECISION,
    "attenuationOut" DOUBLE PRECISION,
    "inputCoreColor" TEXT,

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
    "siteId" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

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
    "reason" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "startPhoto" TEXT,
    "startLocation" TEXT,
    "endPhoto" TEXT,
    "endLocation" TEXT,
    "duration" INTEGER,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "holidayDescription" TEXT,
    "isHolidayOvertime" BOOLEAN NOT NULL DEFAULT false,
    "isNationalHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isOffDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Overtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pelanggan" (
    "id" TEXT NOT NULL,
    "idPelanggan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
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
    "is2FAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isBillNotifEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPromoEnabled" BOOLEAN NOT NULL DEFAULT false,
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
    "autoIsolir" BOOLEAN NOT NULL DEFAULT true,
    "siteId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "mixRadiusId" TEXT,
    "syncError" TEXT,
    "syncRetryCount" INTEGER NOT NULL DEFAULT 0,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "lastVersionCode" INTEGER,
    "lastVersionName" TEXT,
    "lastVersionUpdate" TIMESTAMP(3),
    "pushToken" TEXT,
    "pushTokenUpdatedAt" TIMESTAMP(3),

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
    "siteId" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

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
    "siteId" TEXT,

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
    "isTechnical" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "canApproveRab" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "departmentId" TEXT,
    "siteId" TEXT,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workingHourMode" "WorkingHourMode" NOT NULL DEFAULT 'FIXED',
    "attendanceGeofencePolicy" "AttendanceGeofencePolicy" NOT NULL DEFAULT 'WARN',
    "startWorkTime" TEXT,
    "endWorkTime" TEXT,
    "workDays" TEXT,
    "shiftId" TEXT,
    "flexibleTargetHour" INTEGER,
    "pushToken" TEXT,
    "pushTokenUpdatedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastVersionCode" INTEGER,
    "lastVersionName" TEXT,
    "lastVersionUpdate" TIMESTAMP(3),
    "canvasingTarget" INTEGER NOT NULL DEFAULT 50,
    "isSales" BOOLEAN NOT NULL DEFAULT false,
    "absentDeductionRate" DOUBLE PRECISION,
    "basicSalary" DOUBLE PRECISION,
    "employeeType" "EmployeeType" NOT NULL DEFAULT 'KARYAWAN',
    "lateDeductionRate" DOUBLE PRECISION,
    "overtimeCalcTypeHoliday" "RateType" NOT NULL DEFAULT 'PER_HOUR',
    "overtimeCalcTypeNational" "RateType" NOT NULL DEFAULT 'PER_HOUR',
    "overtimeCalcTypeNormal" "RateType" NOT NULL DEFAULT 'PER_HOUR',
    "overtimeRateHoliday" DOUBLE PRECISION,
    "overtimeRateNational" DOUBLE PRECISION,
    "overtimeRateNormal" DOUBLE PRECISION,
    "payDay" INTEGER NOT NULL DEFAULT 1,
    "payPeriodDay" INTEGER NOT NULL DEFAULT 25,
    "woIncentiveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "woIncentiveRate" DOUBLE PRECISION,
    "lastLoginAt" TIMESTAMP(3),
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankAccountName" TEXT,
    "bpjsKesehatan" BOOLEAN NOT NULL DEFAULT false,
    "bpjsKetenagakerjaan" BOOLEAN NOT NULL DEFAULT false,
    "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joinDate" TIMESTAMP(3),
    "ptkpStatus" "PtkpStatus",
    "targetSchema" "TargetSchema" NOT NULL DEFAULT 'MONTHLY_RESET',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "barang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isWorkOrderMaterial" BOOLEAN NOT NULL DEFAULT false,
    "supplierId" TEXT,
    "jenis" "JenisBarang" NOT NULL DEFAULT 'HABIS_PAKAI',
    "kategoriAset" "KategoriAset",

    CONSTRAINT "barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barang_gudang" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "stok" INTEGER NOT NULL DEFAULT 0,
    "stokBaru" INTEGER NOT NULL DEFAULT 0,
    "stokBekas" INTEGER NOT NULL DEFAULT 0,
    "stokRusak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "userId" TEXT,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotoBukti" TEXT[],
    "fotoMetadata" JSONB,

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
    "hargaBeliSatuan" INTEGER DEFAULT 0,

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
    "isReminderTarget" BOOLEAN NOT NULL DEFAULT false,
    "showInMobileWO" BOOLEAN NOT NULL DEFAULT false,

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
    "userId" TEXT,
    "departmentId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "siteId" TEXT,

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
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "packageName" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ipAddress" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT,

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
    "attendanceRadius" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "alasanSelisih" TEXT,

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
    "createdById" TEXT,

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
    "userId" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "mitraId" TEXT,
    "isLead" BOOLEAN NOT NULL DEFAULT false,

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
    "siteId" TEXT,
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
    "disconnectionReason" TEXT,
    "templateId" TEXT,
    "slaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ticketId" TEXT,
    "returnedMaterials" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "heldAt" TIMESTAMP(3),
    "holdReason" TEXT,
    "resumedAt" TIMESTAMP(3),
    "assignedMitraId" TEXT,
    "isWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyOwnerId" TEXT,
    "warrantySla" TIMESTAMP(3),

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_material_returns" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "kondisi" "KondisiBarang" NOT NULL DEFAULT 'BARU',
    "returnedToGudangId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "returnedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "MaterialReturnStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_material_returns_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "apkUrl" TEXT,
    "apkSize" BIGINT,
    "releaseNotes" TEXT,
    "isForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "minVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvasing" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "noKtp" TEXT NOT NULL,
    "noTelpon" TEXT NOT NULL,
    "email" TEXT,
    "alamat" TEXT NOT NULL,
    "kabel" INTEGER NOT NULL,
    "odp" TEXT,
    "paket" TEXT NOT NULL,
    "sn" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "foto" TEXT,
    "status" "CanvasingStatus" NOT NULL DEFAULT 'PENDING',
    "salesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "workOrderId" TEXT,
    "fotoKtp" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "mitraId" TEXT,

    CONSTRAINT "canvasing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_claims" (
    "id" TEXT NOT NULL,
    "canvasingId" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "buktiUrls" TEXT[],
    "buktiMetadata" JSONB,
    "keterangan" TEXT,
    "pointValue" INTEGER NOT NULL DEFAULT 2,
    "status" "PointClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isCashedOut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "point_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "nomorRequest" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "prioritas" TEXT NOT NULL DEFAULT 'NORMAL',
    "requesterId" TEXT NOT NULL,
    "gudangId" TEXT NOT NULL,
    "keterangan" TEXT,
    "catatanApproval" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_items" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "hargaPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHarga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "processedById" TEXT,
    "receivedById" TEXT,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidFromAccountId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "ppnAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "type" "AccountType" NOT NULL DEFAULT 'CASH',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "kodeAsset" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(19,2) NOT NULL,
    "currentValue" DECIMAL(19,2) NOT NULL,
    "residualValue" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "usefulLife" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(19,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_depreciation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'DRAFT',
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "auditedById" TEXT,
    "auditedAt" TIMESTAMP(3),
    "auditNotes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "rateType" "RateType" NOT NULL DEFAULT 'FIXED',
    "defaultAmount" DOUBLE PRECISION,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_details" (
    "id" TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "componentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "loanPaymentId" TEXT,

    CONSTRAINT "salary_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_revisions" (
    "id" TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "revisedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_salary_components" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_materials" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "satuan" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_nodes" (
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "splitter" TEXT,
    "pppoe" TEXT,
    "serialnumber" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attenuation_in" DOUBLE PRECISION,
    "attenuation_out" DOUBLE PRECISION,
    "input_core_color" TEXT,
    "photo" TEXT,
    "metadata" JSONB,

    CONSTRAINT "mapping_nodes_pkey" PRIMARY KEY ("node_id")
);

-- CreateTable
CREATE TABLE "mapping_edges" (
    "edge_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "fiber_type" TEXT,
    "distance" DOUBLE PRECISION,
    "waypoints" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,

    CONSTRAINT "mapping_edges_pkey" PRIMARY KEY ("edge_id")
);

-- CreateTable
CREATE TABLE "map_settings" (
    "id" SERIAL NOT NULL,
    "center_lat" TEXT,
    "center_lng" TEXT,
    "max_zoom_in" TEXT,
    "max_zoom_out" TEXT,
    "default_zoom" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "siteId" TEXT,
    "mixRadiusGroupId" TEXT,
    "finalApprovedRevisionId" TEXT,
    "projectedRevenue" BIGINT NOT NULL DEFAULT 0,
    "projectedOpex" BIGINT NOT NULL DEFAULT 0,
    "status" "RabStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "arpu" BIGINT,
    "growthSettings" JSONB,
    "growthType" "RabGrowthType" NOT NULL DEFAULT 'LINEAR',
    "startDate" TIMESTAMP(3),
    "targetSubscribers" INTEGER,
    "contingencyAmount" BIGINT NOT NULL DEFAULT 0,
    "contingencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasDisbursementPlan" BOOLEAN NOT NULL DEFAULT false,
    "investmentDurationMonths" INTEGER NOT NULL DEFAULT 12,
    "investmentRecoveryType" "RabRecoveryType" NOT NULL DEFAULT 'PERCENTAGE',
    "investmentRecoveryValue" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "investorProfitSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "paymentType" "RabPaymentType" NOT NULL DEFAULT 'PREPAID',
    "nplTolerancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mixRadiusInvestorSiteId" TEXT,

    CONSTRAINT "rab_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_revisions" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RabRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "totalCapex" BIGINT NOT NULL DEFAULT 0,
    "totalOpex" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rab_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_revision_approvals" (
    "id" TEXT NOT NULL,
    "rabRevisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rab_revision_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_revision_items" (
    "id" TEXT NOT NULL,
    "rabRevisionId" TEXT NOT NULL,
    "rabItemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" BIGINT NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "category" "RabItemCategory" NOT NULL DEFAULT 'HARDWARE',
    "expenseType" "RabExpenseType" NOT NULL DEFAULT 'CAPEX',
    "expenseCategoryId" TEXT,
    "wbsId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rab_revision_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_approvals" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rab_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_items" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" BIGINT NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "category" "RabItemCategory" NOT NULL DEFAULT 'HARDWARE',
    "expenseType" "RabExpenseType" NOT NULL DEFAULT 'CAPEX',
    "expenseCategoryId" TEXT,
    "wbsId" TEXT,

    CONSTRAINT "rab_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_wbs" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rab_wbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_disbursements" (
    "id" TEXT NOT NULL,
    "rabItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" BIGINT NOT NULL,
    "estimatedDate" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rab_disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acs_vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturerPatterns" TEXT NOT NULL,
    "productPatterns" TEXT NOT NULL,
    "parameterPrefix" TEXT,
    "serviceListPath" TEXT,
    "lanBindingPath" TEXT,
    "vlanIdPath" TEXT,
    "httpWanEnablePath" TEXT,
    "firewallLevelPath" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acs_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acs_wifi_security" (
    "id" TEXT NOT NULL,
    "productClass" TEXT NOT NULL,
    "parameterPath" TEXT NOT NULL,
    "wpaTypes" TEXT,
    "encryptTypes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acs_wifi_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_actual_achievements" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "actualSubscribers" INTEGER NOT NULL,
    "actualRevenue" BIGINT NOT NULL,
    "actualOpex" BIGINT NOT NULL DEFAULT 0,
    "manualRecoveryInstallment" BIGINT,
    "manualInvestorShare" BIGINT,
    "manualCompanyShare" BIGINT,
    "manualInvestorProfitSharePercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rab_actual_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "installment" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Attendance_userId_checkIn_idx" ON "Attendance"("userId", "checkIn");

-- CreateIndex
CREATE INDEX "idx_attendance_user_checkin" ON "Attendance"("userId", "checkIn" DESC);

-- CreateIndex
CREATE INDEX "idx_attendance_user_checkout" ON "Attendance"("userId", "checkOut" DESC);

-- CreateIndex
CREATE INDEX "employee_locations_userId_idx" ON "employee_locations"("userId");

-- CreateIndex
CREATE INDEX "employee_locations_recordedAt_idx" ON "employee_locations"("recordedAt");

-- CreateIndex
CREATE INDEX "employee_locations_userId_recordedAt_idx" ON "employee_locations"("userId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bandwidth_name_key" ON "Bandwidth"("name");

-- CreateIndex
CREATE INDEX "Bandwidth_siteId_idx" ON "Bandwidth"("siteId");

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
CREATE INDEX "ExpenseCategory_type_idx" ON "ExpenseCategory"("type");

-- CreateIndex
CREATE INDEX "ExpenseCategory_parentId_idx" ON "ExpenseCategory"("parentId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");

-- CreateIndex
CREATE INDEX "Expense_siteId_idx" ON "Expense"("siteId");

-- CreateIndex
CREATE INDEX "Expense_mixRadiusGroupId_idx" ON "Expense"("mixRadiusGroupId");

-- CreateIndex
CREATE INDEX "Expense_rabProjectId_idx" ON "Expense"("rabProjectId");

-- CreateIndex
CREATE INDEX "Expense_rabItemId_idx" ON "Expense"("rabItemId");

-- CreateIndex
CREATE INDEX "HargaPaket_bandwidthId_idx" ON "HargaPaket"("bandwidthId");

-- CreateIndex
CREATE INDEX "HargaPaket_featured_idx" ON "HargaPaket"("featured");

-- CreateIndex
CREATE INDEX "HargaPaket_profilePPPId_idx" ON "HargaPaket"("profilePPPId");

-- CreateIndex
CREATE INDEX "HargaPaket_siteId_idx" ON "HargaPaket"("siteId");

-- CreateIndex
CREATE INDEX "HargaPaket_status_idx" ON "HargaPaket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HargaPaket_name_siteId_key" ON "HargaPaket"("name", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_username_key" ON "Investor"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_email_key" ON "Investor"("email");

-- CreateIndex
CREATE INDEX "InvestorPayout_investorId_idx" ON "InvestorPayout"("investorId");

-- CreateIndex
CREATE INDEX "InvestorPayout_date_idx" ON "InvestorPayout"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RabInvestor_rabProjectId_investorId_key" ON "RabInvestor"("rabProjectId", "investorId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Joinbox_siteId_idx" ON "Joinbox"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "JoinboxInput_joinboxId_idx_key" ON "JoinboxInput"("joinboxId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "JoinboxOutput_joinboxId_idx_key" ON "JoinboxOutput"("joinboxId", "idx");

-- CreateIndex
CREATE INDEX "KmzFile_siteId_idx" ON "KmzFile"("siteId");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "idx_leave_dates" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_year_leaveType_key" ON "LeaveBalance"("userId", "year", "leaveType");

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
CREATE INDEX "MikroTikRouter_siteId_idx" ON "MikroTikRouter"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Odc_otbCoreId_key" ON "Odc"("otbCoreId");

-- CreateIndex
CREATE INDEX "Odc_siteId_idx" ON "Odc"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OdcOutput_odcId_idx_key" ON "OdcOutput"("odcId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "Odp_odcOutputId_key" ON "Odp"("odcOutputId");

-- CreateIndex
CREATE INDEX "Odp_siteId_idx" ON "Odp"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OdpOutput_odpId_idx_key" ON "OdpOutput"("odpId", "idx");

-- CreateIndex
CREATE INDEX "Otb_siteId_idx" ON "Otb"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OtbCore_otbId_idx_key" ON "OtbCore"("otbId", "idx");

-- CreateIndex
CREATE INDEX "Overtime_startTime_idx" ON "Overtime"("startTime");

-- CreateIndex
CREATE INDEX "Overtime_status_idx" ON "Overtime"("status");

-- CreateIndex
CREATE INDEX "Overtime_userId_idx" ON "Overtime"("userId");

-- CreateIndex
CREATE INDEX "idx_overtime_user_status" ON "Overtime"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_idPelanggan_key" ON "Pelanggan"("idPelanggan");

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_mixRadiusId_key" ON "Pelanggan"("mixRadiusId");

-- CreateIndex
CREATE INDEX "Pelanggan_email_idx" ON "Pelanggan"("email");

-- CreateIndex
CREATE INDEX "Pelanggan_siteId_idx" ON "Pelanggan"("siteId");

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
CREATE INDEX "Permission_resource_idx" ON "Permission"("resource");

-- CreateIndex
CREATE INDEX "Permission_action_idx" ON "Permission"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE INDEX "Pole_siteId_idx" ON "Pole"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePPP_name_key" ON "ProfilePPP"("name");

-- CreateIndex
CREATE INDEX "ProfilePPP_mikroTikRouterId_idx" ON "ProfilePPP"("mikroTikRouterId");

-- CreateIndex
CREATE INDEX "ProfilePPP_siteId_idx" ON "ProfilePPP"("siteId");

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
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_accessAdminPanel_idx" ON "roles"("accessAdminPanel");

-- CreateIndex
CREATE INDEX "roles_accessEmployeePanel_idx" ON "roles"("accessEmployeePanel");

-- CreateIndex
CREATE INDEX "roles_isRestricted_idx" ON "roles"("isRestricted");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "Settings_key_idx" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_type_idx" ON "SystemLog"("type");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_siteId_idx" ON "User"("siteId");

-- CreateIndex
CREATE INDEX "User_shiftId_idx" ON "User"("shiftId");

-- CreateIndex
CREATE INDEX "user_sites_userId_idx" ON "user_sites"("userId");

-- CreateIndex
CREATE INDEX "user_sites_siteId_idx" ON "user_sites"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sites_userId_siteId_key" ON "user_sites"("userId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

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
CREATE INDEX "transfer_antar_gudang_createdById_idx" ON "transfer_antar_gudang"("createdById");

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
CREATE INDEX "work_order_assignments_mitraId_idx" ON "work_order_assignments"("mitraId");

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
CREATE INDEX "work_orders_assignedMitraId_idx" ON "work_orders"("assignedMitraId");

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
CREATE INDEX "work_orders_status_priority_idx" ON "work_orders"("status", "priority");

-- CreateIndex
CREATE INDEX "work_orders_status_createdAt_idx" ON "work_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "work_orders_status_departmentId_idx" ON "work_orders"("status", "departmentId");

-- CreateIndex
CREATE INDEX "work_orders_type_status_idx" ON "work_orders"("type", "status");

-- CreateIndex
CREATE INDEX "work_orders_createdAt_idx" ON "work_orders"("createdAt");

-- CreateIndex
CREATE INDEX "work_order_material_returns_workOrderId_idx" ON "work_order_material_returns"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_material_returns_barangId_idx" ON "work_order_material_returns"("barangId");

-- CreateIndex
CREATE INDEX "work_order_material_returns_status_idx" ON "work_order_material_returns"("status");

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
CREATE UNIQUE INDEX "app_versions_version_key" ON "app_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_versionCode_key" ON "app_versions"("versionCode");

-- CreateIndex
CREATE INDEX "app_versions_isActive_idx" ON "app_versions"("isActive");

-- CreateIndex
CREATE INDEX "app_versions_platform_idx" ON "app_versions"("platform");

-- CreateIndex
CREATE INDEX "app_versions_versionCode_idx" ON "app_versions"("versionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_code_key" ON "Shift"("code");

-- CreateIndex
CREATE INDEX "Shift_isActive_idx" ON "Shift"("isActive");

-- CreateIndex
CREATE INDEX "canvasing_salesId_idx" ON "canvasing"("salesId");

-- CreateIndex
CREATE INDEX "canvasing_mitraId_idx" ON "canvasing"("mitraId");

-- CreateIndex
CREATE INDEX "canvasing_status_idx" ON "canvasing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "point_claims_canvasingId_key" ON "point_claims"("canvasingId");

-- CreateIndex
CREATE INDEX "point_claims_canvasingId_idx" ON "point_claims"("canvasingId");

-- CreateIndex
CREATE INDEX "point_claims_salesId_idx" ON "point_claims"("salesId");

-- CreateIndex
CREATE INDEX "point_claims_status_idx" ON "point_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_nomorRequest_key" ON "purchase_requests"("nomorRequest");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "assets_kodeAsset_key" ON "assets"("kodeAsset");

-- CreateIndex
CREATE INDEX "assets_barangId_idx" ON "assets"("barangId");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_assignedTo_idx" ON "assets"("assignedTo");

-- CreateIndex
CREATE INDEX "asset_depreciation_logs_assetId_idx" ON "asset_depreciation_logs"("assetId");

-- CreateIndex
CREATE INDEX "salaries_month_year_idx" ON "salaries"("month", "year");

-- CreateIndex
CREATE INDEX "salaries_status_idx" ON "salaries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salaries_userId_month_year_key" ON "salaries"("userId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_name_key" ON "salary_components"("name");

-- CreateIndex
CREATE UNIQUE INDEX "salary_details_loanPaymentId_key" ON "salary_details"("loanPaymentId");

-- CreateIndex
CREATE INDEX "salary_details_salaryId_idx" ON "salary_details"("salaryId");

-- CreateIndex
CREATE INDEX "salary_revisions_salaryId_idx" ON "salary_revisions"("salaryId");

-- CreateIndex
CREATE INDEX "user_salary_components_userId_idx" ON "user_salary_components"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_salary_components_userId_componentId_key" ON "user_salary_components"("userId", "componentId");

-- CreateIndex
CREATE INDEX "work_order_materials_workOrderId_idx" ON "work_order_materials"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_materials_barangId_idx" ON "work_order_materials"("barangId");

-- CreateIndex
CREATE INDEX "work_order_template_items_templateId_idx" ON "work_order_template_items"("templateId");

-- CreateIndex
CREATE INDEX "mapping_edges_source_idx" ON "mapping_edges"("source");

-- CreateIndex
CREATE INDEX "mapping_edges_target_idx" ON "mapping_edges"("target");

-- CreateIndex
CREATE INDEX "rab_projects_finalApprovedRevisionId_idx" ON "rab_projects"("finalApprovedRevisionId");

-- CreateIndex
CREATE INDEX "rab_projects_siteId_idx" ON "rab_projects"("siteId");

-- CreateIndex
CREATE INDEX "rab_projects_status_idx" ON "rab_projects"("status");

-- CreateIndex
CREATE INDEX "rab_revisions_rabProjectId_idx" ON "rab_revisions"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_revisions_status_idx" ON "rab_revisions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rab_revisions_rabProjectId_revisionNumber_key" ON "rab_revisions"("rabProjectId", "revisionNumber");

-- CreateIndex
CREATE INDEX "rab_revision_approvals_rabRevisionId_idx" ON "rab_revision_approvals"("rabRevisionId");

-- CreateIndex
CREATE INDEX "rab_revision_approvals_userId_idx" ON "rab_revision_approvals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_revision_approvals_rabRevisionId_userId_key" ON "rab_revision_approvals"("rabRevisionId", "userId");

-- CreateIndex
CREATE INDEX "rab_revision_items_rabRevisionId_idx" ON "rab_revision_items"("rabRevisionId");

-- CreateIndex
CREATE INDEX "rab_revision_items_rabItemId_idx" ON "rab_revision_items"("rabItemId");

-- CreateIndex
CREATE INDEX "rab_revision_items_wbsId_idx" ON "rab_revision_items"("wbsId");

-- CreateIndex
CREATE INDEX "rab_approvals_rabProjectId_idx" ON "rab_approvals"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_approvals_userId_idx" ON "rab_approvals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_approvals_rabProjectId_userId_key" ON "rab_approvals"("rabProjectId", "userId");

-- CreateIndex
CREATE INDEX "rab_items_wbsId_idx" ON "rab_items"("wbsId");

-- CreateIndex
CREATE INDEX "rab_wbs_rabProjectId_idx" ON "rab_wbs"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_disbursements_rabItemId_idx" ON "rab_disbursements"("rabItemId");

-- CreateIndex
CREATE UNIQUE INDEX "acs_vendors_name_key" ON "acs_vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "acs_wifi_security_productClass_key" ON "acs_wifi_security"("productClass");

-- CreateIndex
CREATE INDEX "company_bank_accounts_isActive_idx" ON "company_bank_accounts"("isActive");

-- CreateIndex
CREATE INDEX "company_bank_accounts_priority_idx" ON "company_bank_accounts"("priority");

-- CreateIndex
CREATE INDEX "rab_actual_achievements_rabProjectId_idx" ON "rab_actual_achievements"("rabProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_actual_achievements_rabProjectId_month_year_key" ON "rab_actual_achievements"("rabProjectId", "month", "year");

-- CreateIndex
CREATE INDEX "employee_loans_userId_idx" ON "employee_loans"("userId");

-- CreateIndex
CREATE INDEX "employee_loans_status_idx" ON "employee_loans"("status");

-- CreateIndex
CREATE INDEX "loan_payments_loanId_idx" ON "loan_payments"("loanId");

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
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bandwidth" ADD CONSTRAINT "Bandwidth_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rabItemId_fkey" FOREIGN KEY ("rabItemId") REFERENCES "rab_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_bandwidthId_fkey" FOREIGN KEY ("bandwidthId") REFERENCES "Bandwidth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_profilePPPId_fkey" FOREIGN KEY ("profilePPPId") REFERENCES "ProfilePPP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPayout" ADD CONSTRAINT "InvestorPayout_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Joinbox" ADD CONSTRAINT "Joinbox_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxInput" ADD CONSTRAINT "JoinboxInput_joinboxId_fkey" FOREIGN KEY ("joinboxId") REFERENCES "Joinbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinboxOutput" ADD CONSTRAINT "JoinboxOutput_joinboxId_fkey" FOREIGN KEY ("joinboxId") REFERENCES "Joinbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KmzFile" ADD CONSTRAINT "KmzFile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikroTikRouter" ADD CONSTRAINT "MikroTikRouter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_otbCoreId_fkey" FOREIGN KEY ("otbCoreId") REFERENCES "OtbCore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdcOutput" ADD CONSTRAINT "OdcOutput_odcId_fkey" FOREIGN KEY ("odcId") REFERENCES "Odc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_odcOutputId_fkey" FOREIGN KEY ("odcOutputId") REFERENCES "OdcOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdpOutput" ADD CONSTRAINT "OdpOutput_odpId_fkey" FOREIGN KEY ("odpId") REFERENCES "Odp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otb" ADD CONSTRAINT "Otb_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtbCore" ADD CONSTRAINT "OtbCore_otbId_fkey" FOREIGN KEY ("otbId") REFERENCES "Otb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overtime" ADD CONSTRAINT "Overtime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_hargaPaketId_fkey" FOREIGN KEY ("hargaPaketId") REFERENCES "HargaPaket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_odpId_fkey" FOREIGN KEY ("odpId") REFERENCES "Odp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pole" ADD CONSTRAINT "Pole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_mikroTikRouterId_fkey" FOREIGN KEY ("mikroTikRouterId") REFERENCES "MikroTikRouter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang" ADD CONSTRAINT "barang_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "device_backups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_usage" ADD CONSTRAINT "customer_usage_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alert_mikrotik_fkey" FOREIGN KEY ("deviceId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_mikrotik_fkey" FOREIGN KEY ("deviceId") REFERENCES "MikroTikRouter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
DELETE FROM "notifications";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "sla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "work_order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_material_returns" ADD CONSTRAINT "work_order_material_returns_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_canvasingId_fkey" FOREIGN KEY ("canvasingId") REFERENCES "canvasing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_claims" ADD CONSTRAINT "point_claims_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_gudangId_fkey" FOREIGN KEY ("gudangId") REFERENCES "gudang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_paidFromAccountId_fkey" FOREIGN KEY ("paidFromAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_logs" ADD CONSTRAINT "asset_depreciation_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_auditedById_fkey" FOREIGN KEY ("auditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_loanPaymentId_fkey" FOREIGN KEY ("loanPaymentId") REFERENCES "loan_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_template_items" ADD CONSTRAINT "work_order_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "work_order_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_source_fkey" FOREIGN KEY ("source") REFERENCES "mapping_nodes"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_target_fkey" FOREIGN KEY ("target") REFERENCES "mapping_nodes"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_finalApprovedRevisionId_fkey" FOREIGN KEY ("finalApprovedRevisionId") REFERENCES "rab_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revisions" ADD CONSTRAINT "rab_revisions_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_rabRevisionId_fkey" FOREIGN KEY ("rabRevisionId") REFERENCES "rab_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_items" ADD CONSTRAINT "rab_revision_items_rabRevisionId_fkey" FOREIGN KEY ("rabRevisionId") REFERENCES "rab_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "rab_wbs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_wbs" ADD CONSTRAINT "rab_wbs_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_disbursements" ADD CONSTRAINT "rab_disbursements_rabItemId_fkey" FOREIGN KEY ("rabItemId") REFERENCES "rab_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_actual_achievements" ADD CONSTRAINT "rab_actual_achievements_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GudangToSite" ADD CONSTRAINT "_GudangToSite_A_fkey" FOREIGN KEY ("A") REFERENCES "gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GudangToSite" ADD CONSTRAINT "_GudangToSite_B_fkey" FOREIGN KEY ("B") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

