import { LeaveStatus, LeaveType } from "@prisma/client";

export type LeaveCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    userId: string;
    userName: string;
    type: LeaveType;
    status: LeaveStatus;
    reason?: string;
    hasConflict?: boolean;
  };
};

export type LeaveConflict = {
  leaveId: string;
  conflictingLeaveIds: string[];
  userId: string;
  userName: string;
  dateRange: {
    start: Date;
    end: Date;
  };
};
