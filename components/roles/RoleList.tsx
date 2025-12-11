'use client'

import { HiOutlinePencil, HiOutlineTrash, HiOutlineUsers, HiOutlineShieldCheck, HiPlus } from 'react-icons/hi2'

interface Role {
  id: string
  name: string
  code: string
  description?: string | null
  permissions: string[]
  priority: number
  isActive: boolean
  assignedUsers: number
}

interface RoleListProps {
  roles: Role[]
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  onCreateNew: () => void
  isLoading?: boolean
}

const PERMISSION_LABELS: Record<string, { label: string; icon: string }> = {
  DASHBOARD: { label: 'Dashboard', icon: '📊' },
  ROLES: { label: 'Roles', icon: '🛡️' },
  NETWORK: { label: 'Network', icon: '🌐' },
  FTTH: { label: 'FTTH', icon: '📡' },
  PAKET: { label: 'Paket', icon: '📦' },
  PELANGGAN: { label: 'Pelanggan', icon: '👤' },
  INVENTORY: { label: 'Inventory', icon: '📦' },
  USERS: { label: 'Users', icon: '👥' },
  HELPDESK: { label: 'Helpdesk', icon: '🎫' },
  WORKORDERS: { label: 'Work Orders', icon: '🔧' },
  HRIS: { label: 'HRIS', icon: '👥' },
  FINANCE: { label: 'Finance', icon: '💰' },
  PENGATURAN: { label: 'Pengaturan', icon: '⚙️' },
}

// Priority logic removed
// const getPriorityColor = (priority: number): string => { ... }

export default function RoleList({
  roles,
  onEdit,
  onDelete,
  onCreateNew,
  isLoading = false
}: RoleListProps) {
  const activeRoles = roles.filter(role => role.isActive)
  const inactiveRoles = roles.filter(role => !role.isActive)

  const RoleCard = ({ role }: { role: Role }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {role.name}
          </h3>
          {/* Role Code removed */}
        </div>
        <div className="flex items-center gap-2">
          {/* Priority badge removed */}
          {role.isActive ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Active
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              Inactive
            </span>
          )}
        </div>
      </div>

      {role.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {role.description}
        </p>
      )}

      {/* Permissions */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Permissions ({role.permissions.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {role.permissions.length > 0 ? (
            role.permissions.slice(0, 4).map(permissionId => {
              const permission = PERMISSION_LABELS[permissionId]
              if (!permission) return null
              return (
                <span
                  key={permissionId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-full"
                  title={permission.label}
                >
                  <span>{permission.icon}</span>
                  {permission.label}
                </span>
              )
            })
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic">
              No permissions assigned
            </span>
          )}
          {role.permissions.length > 4 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
              +{role.permissions.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <HiOutlineUsers className="w-4 h-4" />
          <span>{role.assignedUsers} users assigned</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => onEdit(role)}
          disabled={isLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlinePencil className="w-4 h-4" />
          Edit
        </button>
        <button
          onClick={() => onDelete(role)}
          disabled={isLoading || role.assignedUsers > 0}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={role.assignedUsers > 0 ? 'Cannot delete role with assigned users' : 'Delete role'}
        >
          <HiOutlineTrash className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Role List
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {roles.length} total roles
            </p>
          </div>
          <button
            onClick={onCreateNew}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiPlus className="w-4 h-4" />
            New Role
          </button>
        </div>
      </div>

      {/* Role Lists */}
      <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Active Roles */}
            {activeRoles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                  Active Roles ({activeRoles.length})
                </h3>
                <div className="grid gap-3">
                  {activeRoles.map(role => (
                    <RoleCard key={role.id} role={role} />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Roles */}
            {inactiveRoles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Inactive Roles ({inactiveRoles.length})
                </h3>
                <div className="grid gap-3 opacity-60">
                  {inactiveRoles.map(role => (
                    <RoleCard key={role.id} role={role} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {roles.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <HiOutlineShieldCheck className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  No roles found
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create your first role to get started
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}