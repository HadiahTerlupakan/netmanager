interface RabProjectMetricInput {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
}

interface RabApprovalMetricInput {
  rabProjectId: string;
  createdAt: Date;
}

interface BuildMetricsInput {
  now: Date;
  projects: RabProjectMetricInput[];
  approvals: RabApprovalMetricInput[];
}

export interface RabBottleneckMetrics {
  pendingApprovalCount: number;
  oldestPendingDays: number;
  oldestPendingProjectName: string | null;
  averageApprovalLeadHours: number;
}

export function buildRabBottleneckMetrics(
  input: BuildMetricsInput,
): RabBottleneckMetrics {
  const pendingProjects = input.projects.filter(
    (project) => project.status === "PENDING_APPROVAL",
  );
  const oldestPending = findOldestPendingProject(pendingProjects);
  const leadHours = calculateApprovalLeadHours(input);

  return {
    pendingApprovalCount: pendingProjects.length,
    oldestPendingDays: calculateDaysSince(input.now, oldestPending?.createdAt),
    oldestPendingProjectName: oldestPending?.name ?? null,
    averageApprovalLeadHours: calculateAverageLeadHours(leadHours),
  };
}

function findOldestPendingProject(projects: RabProjectMetricInput[]) {
  return [...projects].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )[0];
}

function calculateDaysSince(now: Date, since?: Date) {
  return since
    ? Math.max(
        0,
        Math.floor((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)),
      )
    : 0;
}

function calculateApprovalLeadHours(input: BuildMetricsInput) {
  const projectMap = new Map(
    input.projects.map((project) => [project.id, project]),
  );
  return input.approvals
    .map((approval) => {
      const project = projectMap.get(approval.rabProjectId);
      if (!project) return null;
      const diffHours =
        (approval.createdAt.getTime() - project.createdAt.getTime()) /
        (60 * 60 * 1000);
      return diffHours >= 0 ? diffHours : null;
    })
    .filter((value): value is number => value !== null);
}

function calculateAverageLeadHours(leadHours: number[]) {
  return leadHours.length > 0
    ? Math.round(
        leadHours.reduce((sum, current) => sum + current, 0) / leadHours.length,
      )
    : 0;
}
