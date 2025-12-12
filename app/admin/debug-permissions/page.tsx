'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'

export default function DebugPermissionsPage() {
  const { data: session } = useSession()
  const { permissions, employee, loading } = useEmployeePermissions()
  const [employeeMeData, setEmployeeMeData] = useState<any>(null)

  useEffect(() => {
    // Fetch data from /api/employee/me
    fetch('/api/employee/me')
      .then(res => res.json())
      .then(data => {
        console.log('[DEBUG-PAGE] Employee/Me data:', data)
        setEmployeeMeData(data)
      })
      .catch(err => {
        console.error('[DEBUG-PAGE] Error fetching employee/me:', err)
      })
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Permissions</h1>

      {/* Session Info */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Session Info</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      {/* EmployeePermissionContext Info */}
      <div className="mb-6 p-4 bg-blue-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">EmployeePermissionContext</h2>
        <div className="mb-2">
          <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
        </div>
        <div className="mb-2">
          <strong>Employee:</strong>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(employee, null, 2)}
          </pre>
        </div>
        <div>
          <strong>Permissions:</strong>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(permissions, null, 2)}
          </pre>
        </div>
      </div>

      {/* API /api/employee/me Info */}
      <div className="mb-6 p-4 bg-green-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">API /api/employee/me Response</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(employeeMeData, null, 2)}
        </pre>
      </div>

      {/* Permission Analysis */}
      {permissions && (
        <div className="mb-6 p-4 bg-yellow-100 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Permission Analysis</h2>
          <div className="mb-2">
            <strong>Total Permissions:</strong> {permissions.allowedFeatures?.length || 0}
          </div>
          <div className="mb-2">
            <strong>Permission List:</strong>
            <ul className="list-disc list-inside text-sm">
              {(permissions.allowedFeatures || []).map((perm: string) => (
                <li key={perm}>{perm}</li>
              ))}
            </ul>
          </div>
          <div className="mb-2">
            <strong>User Role:</strong> {session?.user?.role}
          </div>
          <div className="mb-2">
            <strong>Has Employee:</strong> {employee ? 'Yes' : 'No'}
          </div>
        </div>
      )}

      {/* Menu Items That Should Be Visible */}
      {permissions && (
        <div className="mb-6 p-4 bg-purple-100 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Expected Menu Items</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {permissions.allowedFeatures?.includes('DASHBOARD') && (
              <div className="p-2 bg-white rounded">✅ Dashboard</div>
            )}
            {permissions.allowedFeatures?.includes('USERS') && (
              <div className="p-2 bg-white rounded">✅ Users</div>
            )}
            {permissions.allowedFeatures?.includes('ROLES') && (
              <div className="p-2 bg-white rounded">✅ Roles</div>
            )}
            {permissions.allowedFeatures?.includes('PELANGGAN') && (
              <div className="p-2 bg-white rounded">✅ Pelanggan</div>
            )}
            {permissions.allowedFeatures?.includes('NETWORK') && (
              <div className="p-2 bg-white rounded">✅ Network</div>
            )}
            {permissions.allowedFeatures?.includes('FTTH') && (
              <div className="p-2 bg-white rounded">✅ FTTH</div>
            )}
            {permissions.allowedFeatures?.includes('PAKET') && (
              <div className="p-2 bg-white rounded">✅ Paket</div>
            )}
            {permissions.allowedFeatures?.includes('INVENTORY') && (
              <div className="p-2 bg-white rounded">✅ Inventory</div>
            )}
            {permissions.allowedFeatures?.includes('HELPDESK') && (
              <div className="p-2 bg-white rounded">✅ Helpdesk</div>
            )}
            {permissions.allowedFeatures?.includes('WORKORDERS') && (
              <div className="p-2 bg-white rounded">✅ Work Orders</div>
            )}
            {permissions.allowedFeatures?.includes('HRIS') && (
              <div className="p-2 bg-white rounded">✅ HRIS</div>
            )}
            {permissions.allowedFeatures?.includes('FINANCE') && (
              <div className="p-2 bg-white rounded">✅ Finance</div>
            )}
            {permissions.allowedFeatures?.includes('PENGATURAN') && (
              <div className="p-2 bg-white rounded">✅ Pengaturan</div>
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="p-4 bg-red-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Debug Instructions</h2>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>Check browser console for [SIDEBAR] logs</li>
          <li>Check browser console for [EMPLOYEE-CONTEXT] logs</li>
          <li>Check server console for [AUTH] logs</li>
          <li>Compare permissions above with visible menus</li>
          <li>If permissions are correct but menus are missing, check sidebar filtering</li>
        </ol>
      </div>
    </div>
  )
}