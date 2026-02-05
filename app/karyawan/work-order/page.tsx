import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkOrderRepository } from '@/lib/repositories';
import EmployeeWorkOrderList from './EmployeeWorkOrderList';
import { redirect } from 'next/navigation';

export default async function WorkOrderPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/karyawan/login');
  }

  // Use type assertion for ExtendedUser
  const user = session.user as { id: string } & typeof session.user;
  const userId = user.id;

  if (!userId) {
    redirect('/karyawan/login');
  }

  const workOrderRepo = getWorkOrderRepository();
  const { workOrders } = await workOrderRepo.findAllForList({
    assignedToId: userId,
  });

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders Saya</h1>
          <p className="text-gray-500 text-sm mt-1">
            Daftar tugas work order yang ditugaskan kepada Anda.
          </p>
        </div>
      </div>

      <EmployeeWorkOrderList initialWorkOrders={workOrders} />
    </div>
  );
}
