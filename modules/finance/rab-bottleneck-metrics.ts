interface RabProjectMetricInput {
  id: string
  name: string
  status: string
  createdAt: Date
}

interface RabApprovalMetricInput {
  rabProjectId: string
  createdAt: Date
}

interface BuildMetricsInput {
  now: Date
  projects: RabProjectMetricInput[]
  approvals: RabApprovalMetricInput[]
}

export interface RabBottleneckMetrics {
  pendingApprovalCount: number
  oldestPendingDays: number
  oldestPendingProjectName: string | null
  averageApprovalLeadHours: number
}

export function buildRabBottleneckMetrics(input: BuildMetricsInput): RabBottleneckMetrics {
  const pendingProjects = input.projects.filter((project) => project.status === 'PENDING_APPROVAL')
  const sortedPending = [...pendingProjects].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
  const oldestPending = sortedPending[0]

  const oldestPendingDays = oldestPending
    ? Math.max(0, Math.floor((input.now.getTime() - oldestPending.createdAt.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  const projectMap = new Map(input.projects.map((project) => [project.id, project]))
  const leadHours = input.approvals
    .map((approval) => {
      const project = projectMap.get(approval.rabProjectId)
      if (!project) {
        return null
      }

      const diffHours = (approval.createdAt.getTime() - project.createdAt.getTime()) / (60 * 60 * 1000)
      return diffHours >= 0 ? diffHours : null
    })
    .filter((value): value is number => value !== null)

  const averageApprovalLeadHours = leadHours.length > 0
    ? Math.round(leadHours.reduce((sum, current) => sum + current, 0) / leadHours.length)
    : 0

  return {
    pendingApprovalCount: pendingProjects.length,
    oldestPendingDays,
    oldestPendingProjectName: oldestPending?.name ?? null,
    averageApprovalLeadHours,
  }
}
