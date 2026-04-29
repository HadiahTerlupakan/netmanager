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
  const jobId = createOvertimeAutoCheckoutJobId(
    input.schedule.id,
    input.schedule.version,
  );
  const candidateJobIds = collectCandidateJobIds(input.schedule.jobId, jobId);

  if (await hasActiveJob(candidateJobIds)) {
    return;
  }

  const delay = Math.max(
    input.schedule.scheduledFor.getTime() - input.startupTime.getTime(),
    INITIAL_DELAY_MS,
  );

  await addOvertimeAutoCheckoutJob(
    {
      overtimeId: input.schedule.overtimeId,
      scheduleId: input.schedule.id,
      version: input.schedule.version,
    },
    { jobId, delay },
  );
  await input.repository.attachAutoCheckoutJobId(
    input.schedule.overtimeId,
    jobId,
  );
}

function createOvertimeAutoCheckoutJobId(
  scheduleId: string,
  version: number,
): string {
  return `overtime:auto-checkout:${scheduleId}:v${version}`;
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
