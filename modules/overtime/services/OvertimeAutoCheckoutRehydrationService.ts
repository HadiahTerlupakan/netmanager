import {
  addOvertimeAutoCheckoutJob,
  getOvertimeAutoCheckoutJob,
} from "@/lib/event-bus/queues";

import { OvertimeRepository } from "../repositories/OvertimeRepository";

const INITIAL_DELAY_MS = 0;

/** Menjadwalkan ulang job auto checkout lembur yang belum aktif saat startup. */
export async function rehydrateOvertimeAutoCheckoutJobs(): Promise<void> {
  const repository = new OvertimeRepository();
  const startupTime = new Date();
  const schedules = await repository.findSchedulesForRehydration(startupTime);

  for (const schedule of schedules) {
    await rehydrateSchedule({ repository, schedule, startupTime });
  }
}

async function rehydrateSchedule(input: {
  repository: OvertimeRepository;
  schedule: Awaited<
    ReturnType<OvertimeRepository["findSchedulesForRehydration"]>
  >[number];
  startupTime: Date;
}): Promise<void> {
  const payload = createSchedulePayload(input.schedule, input.startupTime);
  if (await hasActiveJob(payload.candidateJobIds)) {
    return;
  }

  await addOvertimeAutoCheckoutJob(payload.jobData, payload.jobOptions);
  await input.repository.attachAutoCheckoutJobId(
    input.schedule.overtimeId,
    payload.jobOptions.jobId,
  );
}

function createSchedulePayload(
  schedule: Awaited<
    ReturnType<OvertimeRepository["findSchedulesForRehydration"]>
  >[number],
  startupTime: Date,
) {
  const jobId = createOvertimeAutoCheckoutJobId(schedule.id, schedule.version);

  return {
    candidateJobIds: collectCandidateJobIds(schedule.jobId, jobId),
    jobData: {
      overtimeId: schedule.overtimeId,
      scheduleId: schedule.id,
      version: schedule.version,
    },
    jobOptions: {
      jobId,
      delay: calculateScheduleDelay(schedule.scheduledFor, startupTime),
    },
  };
}

function calculateScheduleDelay(scheduledFor: Date, startupTime: Date) {
  return Math.max(
    scheduledFor.getTime() - startupTime.getTime(),
    INITIAL_DELAY_MS,
  );
}

function createOvertimeAutoCheckoutJobId(
  scheduleId: string,
  version: number,
): string {
  return `overtime.auto-checkout.${scheduleId}.v${version}`;
}

function collectCandidateJobIds(
  legacyJobId: string | null,
  currentJobId: string,
): string[] {
  return [...new Set([legacyJobId, currentJobId].filter(Boolean))];
}

async function hasActiveJob(candidateJobIds: string[]): Promise<boolean> {
  for (const candidateJobId of candidateJobIds) {
    const existingJob = await getOvertimeAutoCheckoutJob(candidateJobId);
    if (existingJob) {
      return true;
    }
  }

  return false;
}
