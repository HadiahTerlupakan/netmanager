import {
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiEye,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { ACTIONS } from "@/lib/permission-config";
import {
  getResourceCapabilities,
  getResourceDisplayName,
  type ResourceAction,
} from "@/lib/resource-capabilities";
import { getCapabilityActions } from "./role-permission-actions";

/** Aksi CRUD dalam urutan tampil kartu resource. */
const CRUD_ACTIONS = ["read", "create", "update", "delete"] as const;

/** Aksi pembatasan jangkauan data (site/departemen). */
const SCOPE_ACTIONS = ["site_only", "department_only"] as const;

const NON_SPECIAL_ACTIONS: readonly string[] = [
  ...CRUD_ACTIONS,
  ...SCOPE_ACTIONS,
];

const CRUD_ICONS: Record<string, React.ReactNode> = {
  read: <FiEye className="w-4 h-4" />,
  create: <FiPlus className="w-4 h-4" />,
  update: <FiEdit2 className="w-4 h-4" />,
  delete: <FiTrash2 className="w-4 h-4" />,
};

const CRUD_LABELS: Record<string, string> = {
  read: "View",
  create: "Add",
  update: "Edit",
  delete: "Del",
};

/** Tambah atau buang satu izin dari daftar. */
function togglePermission(permissions: string[], permissionId: string) {
  return permissions.includes(permissionId)
    ? permissions.filter((p) => p !== permissionId)
    : [...permissions, permissionId];
}

interface PermissionChangeProps {
  permissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
}

interface PermissionGroupCardProps extends PermissionChangeProps {
  groupName: string;
  resources: readonly string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Dipanggil saat seluruh grup dicentang (untuk membuka grup). */
  onGroupSelectAll?: () => void;
}

/** Satu kelompok resource di matriks hak akses: centang massal + kartu per resource. */
export function PermissionGroupCard({
  groupName,
  resources,
  permissions,
  onPermissionsChange,
  isExpanded,
  onToggleExpand,
  onGroupSelectAll,
}: PermissionGroupCardProps) {
  const groupActions = resources.flatMap((resource) =>
    ACTIONS.map((action) => `${resource}:${action}`),
  );
  const selectedGroupActions = groupActions.filter((p) =>
    permissions.includes(p),
  );
  const isGroupChecked = groupActions.every((p) => permissions.includes(p));
  const isGroupIndeterminate =
    selectedGroupActions.length > 0 && !isGroupChecked;

  const handleGroupToggle = (checked: boolean) => {
    if (checked) {
      onPermissionsChange([...new Set([...permissions, ...groupActions])]);
      onGroupSelectAll?.();
      return;
    }
    onPermissionsChange(permissions.filter((p) => !groupActions.includes(p)));
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200">
      <div
        className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isGroupChecked}
              ref={(input) => {
                if (input) input.indeterminate = isGroupIndeterminate;
              }}
              onChange={(e) => handleGroupToggle(e.target.checked)}
              aria-label={`Pilih semua ${groupName}`}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
            />
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 capitalize select-none">
            {groupName.toLowerCase().replace(/_/g, " ")}
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded-full">
            {selectedGroupActions.length} / {groupActions.length}
          </span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {isExpanded ? (
            <FiChevronUp className="w-5 h-5" />
          ) : (
            <FiChevronDown className="w-5 h-5" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 animate-fadeIn">
          {resources.map((resource) => (
            <ResourcePermissionCard
              key={resource}
              resource={resource}
              permissions={permissions}
              onPermissionsChange={onPermissionsChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ResourcePermissionCardProps extends PermissionChangeProps {
  resource: string;
}

/** Kartu satu resource: aksi CRUD, aksi khusus, dan pembatasan jangkauan. */
function ResourcePermissionCard({
  resource,
  permissions,
  onPermissionsChange,
}: ResourcePermissionCardProps) {
  const capabilities = getResourceCapabilities(resource);
  const availableActions: string[] = ACTIONS.filter((action) =>
    capabilities.includes(action as ResourceAction),
  );
  const crudActions = CRUD_ACTIONS.filter((a) => availableActions.includes(a));
  const scopeActions = SCOPE_ACTIONS.filter((a) =>
    availableActions.includes(a),
  );
  const specialActions = availableActions.filter(
    (a) => !NON_SPECIAL_ACTIONS.includes(a),
  );

  // Tombol "Semua" sengaja hanya mencakup aksi kemampuan, bukan aksi
  // pembatasan (`site_only`/`department_only`): menekan tombol yang terbaca
  // "beri semua akses" tidak boleh MENGURANGI jangkauan data role.
  const resourcePermissionIds = getCapabilityActions(availableActions).map(
    (action) => `${resource}:${action}`,
  );
  const isAllSelected = resourcePermissionIds.every((id) =>
    permissions.includes(id),
  );

  const toggleResourceAll = () => {
    onPermissionsChange(
      isAllSelected
        ? permissions.filter((id) => !resourcePermissionIds.includes(id))
        : [...new Set([...permissions, ...resourcePermissionIds])],
    );
  };

  const toggleAction = (action: string) =>
    onPermissionsChange(togglePermission(permissions, `${resource}:${action}`));
  const isActionSelected = (action: string) =>
    permissions.includes(`${resource}:${action}`);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
          {getResourceDisplayName(resource)}
        </h4>
        <button
          type="button"
          onClick={toggleResourceAll}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
            isAllSelected
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              : "bg-white border border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50"
          }`}
        >
          {isAllSelected ? "Unselect All" : "Select All"}
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-4">
        {crudActions.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
              Basic Access
            </span>
            <div className="grid grid-cols-4 gap-2">
              {CRUD_ACTIONS.map((action) => {
                if (!crudActions.includes(action)) {
                  return (
                    <div
                      key={action}
                      className="h-9 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700/50"
                    ></div>
                  );
                }
                const isSelected = isActionSelected(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all h-full ${
                      isSelected
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                    }`}
                    title={action}
                  >
                    <span className="mb-1">{CRUD_ICONS[action]}</span>
                    <span className="text-[10px] font-medium">
                      {CRUD_LABELS[action]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {specialActions.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
              Special Actions
            </span>
            <div className="flex flex-wrap gap-2">
              {specialActions.map((action) => {
                const isSelected = isActionSelected(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300"
                        : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-purple-500" : "bg-gray-300"}`}
                    ></span>
                    {action.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {scopeActions.length > 0 && (
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                <strong>Info:</strong> Mengaktifkan pembatasan di bawah akan{" "}
                <strong>MEMBATASI</strong> user hanya ke data site/departemen
                mereka sendiri. Jika tidak diaktifkan, user bisa melihat{" "}
                <strong>semua</strong> data.
              </p>
            </div>
            <div className="space-y-2">
              {scopeActions.map((action) => {
                const isSelected = isActionSelected(action);
                const isSiteScope = action === "site_only";
                const scopeLabel = isSiteScope
                  ? "Site Sendiri"
                  : "Departemen Sendiri";
                const scopeDescription = isSiteScope
                  ? "User hanya dapat mengakses data dari site yang ditugaskan kepadanya"
                  : "User hanya dapat mengakses data dari departemen yang sama";

                return (
                  <label
                    key={action}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    }`}
                    title={scopeDescription}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-4 rounded-full relative transition-colors ${isSelected ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"}`}
                      >
                        <div
                          className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm"
                          style={{
                            left: isSelected ? "calc(100% - 14px)" : "2px",
                          }}
                        ></div>
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-xs font-medium ${isSelected ? "text-amber-800 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"}`}
                        >
                          Batasi ke {scopeLabel}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-500">
                            Aktif - akses dibatasi
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isSelected}
                      onChange={() => toggleAction(action)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
