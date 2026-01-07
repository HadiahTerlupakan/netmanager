

import { prisma } from './lib/prisma'


async function main() {
  const userId = 'cmjgwlom3001vqt1ga4fvn4k2'
  console.log('Checking data for user:', userId)

  const attendanceCount = await prisma.attendance.count({ where: { userId } })
  console.log('Attendance Count:', attendanceCount)
  if (attendanceCount > 0) {
      const lastAttendance = await prisma.attendance.findFirst({ where: { userId }, orderBy: { checkIn: 'desc' }})
      console.log('Last Attendance:', lastAttendance)
  }

  const woCount = await prisma.workOrders.count({ where: { assignedToId: userId } })
  console.log('WorkOrder Count:', woCount)

  const leaveCount = await prisma.leaveRequest.count({ where: { userId } })
  console.log('Leave Count:', leaveCount)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
