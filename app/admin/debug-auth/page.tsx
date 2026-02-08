
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getUserPermissions } from "@/lib/auth";

export default async function DebugAuthPage() {
  const session = await getServerSession(authConfig);
  const user = session?.user as any;
  const userId = user?.id;

  // Run checks
  const canReadExpense = await hasPermission("expense:read");
  const canReadUsers = await hasPermission("users:read");
  const permissionsFromDB = userId ? await getUserPermissions(userId) : [];

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800">Debug Auth Session & Permissions</h1>

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
        <h2 className="text-xl font-semibold border-b pb-2">Session Data</h2>
        <div className="bg-gray-100 p-4 rounded overflow-auto text-sm font-mono max-h-60">
          <pre>{JSON.stringify(session, null, 2)}</pre>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold border-b pb-2">User Claims</h2>
          <ul className="space-y-2">
            <li><strong>User ID:</strong> {user?.id}</li>
            <li><strong>Name:</strong> {user?.name}</li>
            <li><strong>Email:</strong> {user?.email}</li>
            <li><strong>Role (Session):</strong> {user?.role}</li>
            <li><strong>isSuperAdmin (Session):</strong> <span className={user?.isSuperAdmin ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{String(user?.isSuperAdmin)}</span></li>
            <li><strong>Permissions Count (Session):</strong> {user?.permissionsCount}</li>
          </ul>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold border-b pb-2">Permission Checks (Server-Side)</h2>
          <ul className="space-y-2">
            <li>
              <strong>hasPermission("expense:read"):</strong>{' '}
              <span className={canReadExpense ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {String(canReadExpense)}
              </span>
            </li>
            <li>
              <strong>hasPermission("users:read"):</strong>{' '}
              <span className={canReadUsers ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {String(canReadUsers)}
              </span>
            </li>
            <li>
              <strong>DB Permissions Loaded:</strong> {permissionsFromDB.length}
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4 border border-gray-200">
        <h2 className="text-xl font-semibold border-b pb-2">Raw DB Permissions</h2>
        <div className="bg-gray-100 p-4 rounded overflow-auto text-xs font-mono max-h-40">
          {permissionsFromDB.join(', ')}
        </div>
      </div>
    </div>
  );
}
