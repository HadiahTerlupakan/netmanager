-- AlterTable
ALTER TABLE "Overtime" ADD COLUMN     "holidayDescription" TEXT,
ADD COLUMN     "isHolidayOvertime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNationalHoliday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOffDay" BOOLEAN NOT NULL DEFAULT false;
