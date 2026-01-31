
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting duplicate attendance cleanup...')

  // 1. Get all attendance records ordered by userId and checkIn time
  const allAttendance = await prisma.attendance.findMany({
    orderBy: [
      { userId: 'asc' },
      { checkIn: 'asc' }
    ]
  })

  console.log(`Found ${allAttendance.length} total attendance records. Analyzing for duplicates...`)

  const seen = new Map() // Key: "userId_YYYY-MM-DD", Value: firstAttendanceId
  const duplicatesToDelete = []

  for (const record of allAttendance) {
    const checkInDate = new Date(record.checkIn).toISOString().split('T')[0] // YYYY-MM-DD
    const key = `${record.userId}_${checkInDate}`

    if (seen.has(key)) {
      // Duplicate found! (Since we ordered by checkIn ASC, this is the LATER one)
      console.log(`Duplicate found: User ${record.userId} on ${checkInDate}. Keeping ID ${seen.get(key)}, Deleting ID ${record.id}`)
      duplicatesToDelete.push(record.id)
    } else {
      // First time seeing this user on this day
      seen.set(key, record.id)
    }
  }

  console.log(`\nFound ${duplicatesToDelete.length} duplicates to delete.`)

  if (duplicatesToDelete.length > 0) {
    // 2. Bulk delete
    const result = await prisma.attendance.deleteMany({
      where: {
        id: {
          in: duplicatesToDelete
        }
      }
    })
    console.log(`\nSuccessfully deleted ${result.count} duplicate records.`)
  } else {
    console.log('\nNo duplicates found.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
