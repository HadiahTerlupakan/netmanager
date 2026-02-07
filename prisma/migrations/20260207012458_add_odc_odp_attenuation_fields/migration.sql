-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "depreciation" BIGINT DEFAULT 0,
ADD COLUMN     "expenseCategoryId" TEXT,
ADD COLUMN     "mixRadiusGroupId" TEXT,
ADD COLUMN     "usefulLife" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "MixRadiusCustomer" ADD COLUMN     "ownerName" TEXT;

-- AlterTable
ALTER TABLE "Odc" ADD COLUMN     "attenuationIn" DOUBLE PRECISION,
ADD COLUMN     "attenuationOut" DOUBLE PRECISION,
ADD COLUMN     "inputCoreColor" TEXT;

-- AlterTable
ALTER TABLE "Odp" ADD COLUMN     "attenuationIn" DOUBLE PRECISION,
ADD COLUMN     "attenuationOut" DOUBLE PRECISION,
ADD COLUMN     "inputCoreColor" TEXT;

-- AlterTable
ALTER TABLE "mapping_nodes" ADD COLUMN     "attenuation_in" DOUBLE PRECISION,
ADD COLUMN     "attenuation_out" DOUBLE PRECISION,
ADD COLUMN     "input_core_color" TEXT;

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mix_radius_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "mixRadiusId" TEXT,
    "username" TEXT NOT NULL,
    "fullName" TEXT,
    "planName" TEXT,
    "amount" DECIMAL(19,2) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "expiredOn" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mix_radius_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_type_key" ON "ExpenseCategory"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "mix_radius_invoices_invoiceNumber_key" ON "mix_radius_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "mix_radius_invoices_status_idx" ON "mix_radius_invoices"("status");

-- CreateIndex
CREATE INDEX "mix_radius_invoices_username_idx" ON "mix_radius_invoices"("username");

-- CreateIndex
CREATE INDEX "mix_radius_invoices_dueDate_idx" ON "mix_radius_invoices"("dueDate");

-- CreateIndex
CREATE INDEX "Expense_mixRadiusGroupId_idx" ON "Expense"("mixRadiusGroupId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_mixRadiusGroupId_fkey" FOREIGN KEY ("mixRadiusGroupId") REFERENCES "MixRadiusOwnerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mix_radius_invoices" ADD CONSTRAINT "mix_radius_invoices_username_fkey" FOREIGN KEY ("username") REFERENCES "MixRadiusCustomer"("username") ON DELETE RESTRICT ON UPDATE CASCADE;
