import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { LeaveRepository } from '@/modules/attendance'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function getStatusBadge(status: string) {
  const classes: Record<string, string> = {
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  }

  return classes[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

export default async function KaryawanIzinPage() {
  const session = await getServerSession(authConfig)
  const userId = session?.user?.id

  const repo = new LeaveRepository()
  const requests = userId ? await repo.findAll({ userId, take: 20 }) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Izin</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Lihat status pengajuan izin dan cuti terbaru Anda.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Belum ada pengajuan izin.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {requests.map((request) => (
              <div key={request.id} className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{request.type}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{request.reason}</p>
                {request.rejectionReason ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Alasan penolakan: {request.rejectionReason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
