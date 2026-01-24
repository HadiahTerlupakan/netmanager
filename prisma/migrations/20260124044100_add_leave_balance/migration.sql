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

-- CreateIndex
CREATE INDEX "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_year_leaveType_key" ON "LeaveBalance"("userId", "year", "leaveType");

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
