import { Prisma } from "@prisma/client";
import { AttendanceRepositoryFacade } from "./AttendanceRepositoryFacade";

export type AttendanceCorrectionSource = Prisma.AttendanceGetPayload<{
  include: {
    user: {
      include: { shift: true };
    };
  };
}>;

export class AttendanceRepository extends AttendanceRepositoryFacade {}
