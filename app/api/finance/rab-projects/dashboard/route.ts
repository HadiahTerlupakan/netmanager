import { prisma } from '@/modules/database'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { buildRabBottleneckMetrics } from '@/modules/finance'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const isSuperAdmin = ctx.permissions.includes('*')
  const hasReadAccess = isSuperAdmin
    || ctx.permissions.includes('expense:read')
    || ctx.permissions.includes('mixradius_expenses:read')

  if (!hasReadAccess) {
    return ApiErrors.forbidden('Akses ditolak')
  }

  const [pendingProjects, approvedApprovals] = await Promise.all([
    prisma.rabProject.findMany({
      where: { status: 'PENDING_APPROVAL' },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.rabApproval.findMany({
      where: {
        status: 'APPROVED',
        rabProject: { status: 'APPROVED' },
      },
      select: {
        rabProjectId: true,
        createdAt: true,
        rabProject: {
          select: { id: true, name: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const projectsMap = new Map<string, { id: string; name: string; status: string; createdAt: Date }>()
  pendingProjects.forEach((project) => {
    projectsMap.set(project.id, project)
  })
  approvedApprovals.forEach((approval) => {
    if (approval.rabProject) {
      projectsMap.set(approval.rabProject.id, approval.rabProject)
    }
  })

  const metrics = buildRabBottleneckMetrics({
    now: new Date(),
    projects: Array.from(projectsMap.values()),
    approvals: approvedApprovals.map((approval) => ({
      rabProjectId: approval.rabProjectId,
      createdAt: approval.createdAt,
    })),
  })

  return apiSuccess(metrics)
})
