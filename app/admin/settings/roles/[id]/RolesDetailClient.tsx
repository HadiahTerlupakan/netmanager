"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "react-hot-toast";
import {
  FiArrowLeft,
  FiSave,
  FiEye,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
  FiX,
} from "react-icons/fi";
import {
  HiOutlineWrench,
  HiOutlineComputerDesktop,
  HiOutlineBanknotes,
  HiOutlinePresentationChartBar,
  HiOutlineBriefcase,
  HiOutlineGlobeAlt,
  HiOutlineCube,
  HiOutlineBolt,
} from "react-icons/hi2";
import { MdOutlineHeadsetMic } from "react-icons/md";
import {
  PERMISSION_GROUPS,
  PERMISSION_GROUPS_MOBILE,
  ACTIONS,
} from "@/lib/permission-config";
import { getResourceCapabilities } from "@/lib/resource-capabilities";
import { ROLE_TEMPLATES, type RoleTemplate } from "@/lib/role-templates";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  wrench: <HiOutlineWrench className="w-5 h-5" />,
  computer: <HiOutlineComputerDesktop className="w-5 h-5" />,
  headset: <MdOutlineHeadsetMic className="w-5 h-5" />,
  banknotes: <HiOutlineBanknotes className="w-5 h-5" />,
  chart: <HiOutlinePresentationChartBar className="w-5 h-5" />,
  briefcase: <HiOutlineBriefcase className="w-5 h-5" />,
  globe: <HiOutlineGlobeAlt className="w-5 h-5" />,
  cube: <HiOutlineCube className="w-5 h-5" />,
};
import type { ResourceAction } from "@/lib/resource-capabilities";

// Helper: daftar semua resource admin & mobile untuk validasi konsistensi
const _ALL_ADMIN_RESOURCES = Object.values(
  PERMISSION_GROUPS,
).flat() as string[];
const _ALL_MOBILE_RESOURCES = Object.values(
  PERMISSION_GROUPS_MOBILE,
).flat() as string[];

export function ClientComponent() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const { hasPermission, isLoading: authLoading } = usePermission();

  const isMain =
    session?.user?.tenantId === "8bceb512-ccef-4f53-bcc8-dd372cbf87e0";

  const isNew = params?.id === "new";
  const roleId = params?.id as string;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    accessAdminPanel: false,
    accessEmployeePanel: false,
    isRestricted: false,
    isTechnical: false,
    isSuperAdmin: false,
    canApproveRab: false,
    canReceiveWhatsappApproval: false,
    permissions: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"admin" | "employee">("admin");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(isNew);

  const applyTemplate = (template: RoleTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      accessAdminPanel: template.accessAdminPanel,
      accessEmployeePanel: template.accessEmployeePanel,
      isRestricted: template.isRestricted,
      isTechnical: template.isTechnical,
      isSuperAdmin: template.isSuperAdmin,
      canApproveRab: false,
      canReceiveWhatsappApproval: false,
      permissions: [...template.permissions],
    });
    setSelectedTemplate(template.id);
    setShowTemplates(false);

    // Auto-expand groups that have permissions
    const activeResources = new Set(
      template.permissions.map((p) => p.split(":")[0]),
    );
    const groupsToExpand: string[] = [];
    Object.entries(PERMISSION_GROUPS).forEach(([groupName, resources]) => {
      if (
        (resources as readonly string[]).some((r) => activeResources.has(r))
      ) {
        groupsToExpand.push(`admin-${groupName}`);
      }
    });
    Object.entries(PERMISSION_GROUPS_MOBILE).forEach(
      ([groupName, resources]) => {
        if (
          (resources as readonly string[]).some((r) => activeResources.has(r))
        ) {
          groupsToExpand.push(`employee-${groupName}`);
        }
      },
    );
    setExpandedGroups(groupsToExpand);

    // Switch to the right tab
    if (template.accessAdminPanel) {
      setActiveTab("admin");
    } else if (template.accessEmployeePanel) {
      setActiveTab("employee");
    }

    toast.success(`Template "${template.name}" diterapkan`);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupName)
        ? prev.filter((g) => g !== groupName)
        : [...prev, groupName],
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If editing, fetch role data
        if (!isNew) {
          const roleRes = await fetch(`/api/roles/${roleId}`);
          const roleData = await roleRes.json();

          if (roleRes.ok) {
            setFormData({
              name: roleData.name,
              description: roleData.description || "",
              accessAdminPanel: roleData.accessAdminPanel || false,
              accessEmployeePanel: roleData.accessEmployeePanel || false,
              isRestricted: roleData.isRestricted || false,
              isTechnical: roleData.isTechnical || false,
              isSuperAdmin: roleData.isSuperAdmin || false,
              canApproveRab: roleData.canApproveRab || false,
              canReceiveWhatsappApproval:
                roleData.canReceiveWhatsappApproval || false,
              // Convert backend permissions (objects) to string format resource:action
              permissions: roleData.permissions.map(
                (p: { resource: string; action: string }) =>
                  `${p.resource}:${p.action}`,
              ),
            });

            // Calculate expanded groups based on active resources
            const activeResources = new Set(
              roleData.permissions.map((p: { resource: string }) => p.resource),
            );
            const groupsToExpand: string[] = [];

            // Check Admin Groups
            Object.entries(PERMISSION_GROUPS).forEach(
              ([groupName, resources]) => {
                if (
                  (resources as readonly string[]).some((r) =>
                    activeResources.has(r),
                  )
                ) {
                  groupsToExpand.push(`admin-${groupName}`);
                }
              },
            );

            // Check Mobile Groups
            Object.entries(PERMISSION_GROUPS_MOBILE).forEach(
              ([groupName, resources]) => {
                if (
                  (resources as readonly string[]).some((r) =>
                    activeResources.has(r),
                  )
                ) {
                  groupsToExpand.push(`employee-${groupName}`);
                }
              },
            );

            setExpandedGroups(groupsToExpand);

            // Auto-select initial tab based on portal access
            if (roleData.accessAdminPanel) {
              setActiveTab("admin");
            } else if (roleData.accessEmployeePanel) {
              setActiveTab("employee");
            }
          } else {
            toast.error(roleData.error || "Gagal memuat data role");
            router.push("/admin/pengaturan/hak-akses");
          }
        }
      } catch (error) {
        clientLogger.error("Error fetching data:", error);
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isNew, roleId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isNew ? "/api/roles" : `/api/roles/${roleId}`;
      const method = isNew ? "POST" : "PUT";

      if (isNew && formData.name.toLowerCase() === "new") {
        toast.error("Nama role tidak boleh &quot;new&quot;");
        setSaving(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan role");
      }

      toast.success(
        isNew ? "Role berhasil dibuat" : "Role berhasil diperbarui",
      );
      router.push("/admin/pengaturan/hak-akses");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading)
    return <div className="p-8 text-center">Loading...</div>;

  const requiredPerm = isNew ? "roles:create" : "roles:update";
  if (!hasPermission(requiredPerm)) {
    return (
      <div className="p-8 text-center text-red-500">
        Anda tidak memiliki akses untuk {isNew ? "membuat" : "mengedit"} role.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/pengaturan/hak-akses"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <FiArrowLeft className="text-xl dark:text-white" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {isNew ? "Tambah Role Baru" : `Edit Role: ${formData.name}`}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Informasi Dasar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Role
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-gray-700 dark:text-white"
                placeholder="Contoh: Staff Keuangan"
                disabled={formData.name === "SUPER_ADMIN"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deskripsi
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-gray-700 dark:text-white"
                placeholder="Deskripsi singkat role ini"
              />
            </div>
          </div>
        </div>

        {/* Portal Access */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Akses Portal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.accessAdminPanel}
                onChange={(e) => {
                  const checked = e.target.checked;
                  let newPermissions = formData.permissions;
                  if (!checked) {
                    // Strip all admin permissions (non-m_ resources)
                    newPermissions = newPermissions.filter((p) =>
                      p.split(":")[0].startsWith("m_"),
                    );
                  }
                  setFormData({
                    ...formData,
                    accessAdminPanel: checked,
                    permissions: newPermissions,
                  });
                  if (checked) {
                    setActiveTab("admin");
                  } else if (
                    activeTab === "admin" &&
                    formData.accessEmployeePanel
                  ) {
                    setActiveTab("employee");
                  }
                }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-white">
                  Portal Admin
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Izinkan akses ke dashboard admin dan manajemen sistem (
                  {`/admin`}).
                </span>
              </div>
            </label>
            <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.accessEmployeePanel}
                onChange={(e) => {
                  const checked = e.target.checked;
                  let newPermissions = formData.permissions;
                  if (!checked) {
                    // Strip all mobile permissions (m_* resources)
                    newPermissions = newPermissions.filter(
                      (p) => !p.split(":")[0].startsWith("m_"),
                    );
                  }
                  setFormData({
                    ...formData,
                    accessEmployeePanel: checked,
                    permissions: newPermissions,
                  });
                  if (checked) {
                    setActiveTab("employee");
                  } else if (
                    activeTab === "employee" &&
                    formData.accessAdminPanel
                  ) {
                    setActiveTab("admin");
                  }
                }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-white">
                  Akses Mobile App
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Izinkan user login ke Mobile App karyawan.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Role Type */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            Tipe Role
          </h2>

          {/* SUPER ADMIN TOGGLE - Only for main tenant */}
          {isMain && (
            <label className="flex items-start gap-3 p-4 border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/10 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors mb-4">
              <input
                type="checkbox"
                checked={formData.isSuperAdmin}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isSuperAdmin: e.target.checked,
                    // Auto-enable access if super admin
                    accessAdminPanel: e.target.checked
                      ? true
                      : formData.accessAdminPanel,
                    accessEmployeePanel: e.target.checked
                      ? true
                      : formData.accessEmployeePanel,
                  })
                }
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 mt-0.5"
                disabled={formData.name === "SUPER_ADMIN"} // Cannot uncheck for original Super Admin
              />
              <div>
                <span className="block font-medium text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                  Super Administrator
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full font-bold">
                    POWERFUL
                  </span>
                </span>
                <span className="text-sm text-indigo-700 dark:text-indigo-400">
                  Role ini memiliki <strong>akses penuh</strong> ke seluruh
                  sistem, mengabaikan semua batasan permission dan site.
                </span>
              </div>
            </label>
          )}

          <div
            className={
              formData.isSuperAdmin ? "opacity-50 pointer-events-none" : ""
            }
          >
            <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.isRestricted}
                onChange={(e) =>
                  setFormData({ ...formData, isRestricted: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-white">
                  Role Terbatas (Restricted)
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Jika aktif, role ini <strong>tidak akan muncul</strong> pada
                  dropdown &quot;Peran Pengguna&quot; di menu Tambah/Edit
                  Pengguna, KECUALI user yang sedang login juga memiliki role
                  ini.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors mt-4">
              <input
                type="checkbox"
                checked={formData.isTechnical}
                onChange={(e) =>
                  setFormData({ ...formData, isTechnical: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-white">
                  Role Teknis (Technical)
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Jika aktif, user dengan role ini akan{" "}
                  <strong>dihitung</strong> dalam statistik respon (mis:
                  Helpdesk/Teknisi) dan mendapat indikator khusus di sistem.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/20 cursor-pointer transition-colors mt-4">
              <input
                type="checkbox"
                checked={formData.canApproveRab}
                onChange={(e) =>
                  setFormData({ ...formData, canApproveRab: e.target.checked })
                }
                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-emerald-900 dark:text-emerald-300">
                  Persetujuan RAB (Manager)
                </span>
                <span className="text-sm text-emerald-700 dark:text-emerald-400">
                  Aktifkan ini untuk memberikan wewenang pada role guna
                  menyetujui, mencetak Tanda Tangan, dan mengubah status dokumen
                  Pengajuan RAB dari <strong>DRAFT</strong> menuju{" "}
                  <strong>APPROVED</strong>.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/20 cursor-pointer transition-colors mt-4">
              <input
                type="checkbox"
                checked={formData.canReceiveWhatsappApproval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    canReceiveWhatsappApproval: e.target.checked,
                  })
                }
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500 border-gray-300 mt-0.5"
              />
              <div>
                <span className="block font-medium text-green-900 dark:text-green-300">
                  Penerima Approval WhatsApp
                </span>
                <span className="text-sm text-green-700 dark:text-green-400">
                  Role ini akan menerima pesan WhatsApp untuk approval lembur
                  dan izin. Pisahkan dari permission approve agar tidak semua
                  approver otomatis mendapat notifikasi WA.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Template Picker - Only for new roles, placed after Tipe Role */}
        {isNew && !formData.isSuperAdmin && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <HiOutlineBolt className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                    {selectedTemplate
                      ? `Template: ${ROLE_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}`
                      : "Mulai dari Template"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedTemplate
                      ? "Klik untuk mengganti template atau sesuaikan permission di bawah"
                      : "Pilih template peran untuk mengaktifkan permission secara otomatis"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplate && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplate(null);
                      setFormData((prev) => ({
                        ...prev,
                        permissions: [],
                      }));
                      setExpandedGroups([]);
                      toast.success("Template direset");
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <FiX className="w-3 h-3" /> Reset
                  </span>
                )}
                <div
                  className={`transition-transform duration-200 text-gray-400 ${showTemplates ? "rotate-180" : ""}`}
                >
                  <FiChevronDown className="w-5 h-5" />
                </div>
              </div>
            </button>

            {showTemplates && (
              <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                  {ROLE_TEMPLATES.map((template) => {
                    const isSelected = selectedTemplate === template.id;
                    const colorMap: Record<
                      string,
                      {
                        bg: string;
                        border: string;
                        ring: string;
                        tagBg: string;
                        tagText: string;
                      }
                    > = {
                      blue: {
                        bg: "bg-blue-50 dark:bg-blue-950/30",
                        border: "border-blue-300 dark:border-blue-700",
                        ring: "ring-blue-400",
                        tagBg: "bg-blue-100 dark:bg-blue-900/40",
                        tagText: "text-blue-700 dark:text-blue-300",
                      },
                      indigo: {
                        bg: "bg-indigo-50 dark:bg-indigo-950/30",
                        border: "border-indigo-300 dark:border-indigo-700",
                        ring: "ring-indigo-400",
                        tagBg: "bg-indigo-100 dark:bg-indigo-900/40",
                        tagText: "text-indigo-700 dark:text-indigo-300",
                      },
                      emerald: {
                        bg: "bg-emerald-50 dark:bg-emerald-950/30",
                        border: "border-emerald-300 dark:border-emerald-700",
                        ring: "ring-emerald-400",
                        tagBg: "bg-emerald-100 dark:bg-emerald-900/40",
                        tagText: "text-emerald-700 dark:text-emerald-300",
                      },
                      amber: {
                        bg: "bg-amber-50 dark:bg-amber-950/30",
                        border: "border-amber-300 dark:border-amber-700",
                        ring: "ring-amber-400",
                        tagBg: "bg-amber-100 dark:bg-amber-900/40",
                        tagText: "text-amber-700 dark:text-amber-300",
                      },
                      rose: {
                        bg: "bg-rose-50 dark:bg-rose-950/30",
                        border: "border-rose-300 dark:border-rose-700",
                        ring: "ring-rose-400",
                        tagBg: "bg-rose-100 dark:bg-rose-900/40",
                        tagText: "text-rose-700 dark:text-rose-300",
                      },
                      violet: {
                        bg: "bg-violet-50 dark:bg-violet-950/30",
                        border: "border-violet-300 dark:border-violet-700",
                        ring: "ring-violet-400",
                        tagBg: "bg-violet-100 dark:bg-violet-900/40",
                        tagText: "text-violet-700 dark:text-violet-300",
                      },
                      cyan: {
                        bg: "bg-cyan-50 dark:bg-cyan-950/30",
                        border: "border-cyan-300 dark:border-cyan-700",
                        ring: "ring-cyan-400",
                        tagBg: "bg-cyan-100 dark:bg-cyan-900/40",
                        tagText: "text-cyan-700 dark:text-cyan-300",
                      },
                      orange: {
                        bg: "bg-orange-50 dark:bg-orange-950/30",
                        border: "border-orange-300 dark:border-orange-700",
                        ring: "ring-orange-400",
                        tagBg: "bg-orange-100 dark:bg-orange-900/40",
                        tagText: "text-orange-700 dark:text-orange-300",
                      },
                    };
                    const colors = colorMap[template.color] || colorMap.blue;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 group hover:shadow-md ${
                          isSelected
                            ? `${colors.bg} ${colors.border} ring-2 ${colors.ring} shadow-md`
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                            <FiCheck className="w-3 h-3 text-white" />
                          </div>
                        )}

                        <div className="mb-2 text-gray-600 dark:text-gray-300">
                          {TEMPLATE_ICONS[template.icon] || (
                            <HiOutlineWrench className="w-5 h-5" />
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {template.description}
                        </p>

                        <div className="flex flex-wrap gap-1 mt-3">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                isSelected
                                  ? `${colors.tagBg} ${colors.tagText}`
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {template.permissions.length} permission
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {template.accessAdminPanel &&
                            template.accessEmployeePanel
                              ? "Admin + Mobile"
                              : template.accessAdminPanel
                                ? "Admin Portal"
                                : "Mobile App"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Permission Matrix - Hide if Super Admin */}
        {!formData.isSuperAdmin && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                Matrix Hak Akses
              </h2>
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("admin")}
                  disabled={!formData.accessAdminPanel}
                  className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                    !formData.accessAdminPanel
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : activeTab === "admin"
                        ? "bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  Portal Admin
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("employee")}
                  disabled={!formData.accessEmployeePanel}
                  className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                    !formData.accessEmployeePanel
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : activeTab === "employee"
                        ? "bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  Mobile App
                </button>
              </div>
            </div>

            {/* Warning: Both portals off */}
            {!formData.accessAdminPanel && !formData.accessEmployeePanel && (
              <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <FiX className="w-10 h-10 mx-auto" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Tidak ada portal yang aktif
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Aktifkan minimal satu portal di bagian &quot;Akses
                  Portal&quot; di atas untuk mengatur permission.
                </p>
              </div>
            )}

            {/* Matrix content - only show when at least one portal is active */}
            {(formData.accessAdminPanel || formData.accessEmployeePanel) && (
              <div className="space-y-4">
                {(
                  Object.entries(
                    activeTab === "admin"
                      ? PERMISSION_GROUPS
                      : PERMISSION_GROUPS_MOBILE,
                  ) as unknown as [string, readonly string[]][]
                ).map(([groupName, resources]) => {
                  // RESTRICTION: Hide sensitive resources for non-main tenants
                  const filteredResources = isMain
                    ? resources
                    : resources.filter(
                        (r) =>
                          ![
                            "backup_database",
                            "app_version",
                            "tenants",
                          ].includes(r),
                      );

                  if (filteredResources.length === 0) return null;

                  const groupActions = filteredResources.flatMap((resource) =>
                    ACTIONS.map((action) => `${resource}:${action}`),
                  );
                  const selectedGroupActions = groupActions.filter((p) =>
                    formData.permissions.includes(p),
                  );
                  const isGroupChecked = groupActions.every((p) =>
                    formData.permissions.includes(p),
                  );
                  const isGroupIndeterminate =
                    selectedGroupActions.length > 0 && !isGroupChecked;

                  const groupKey = `${activeTab}-${groupName}`;
                  const isExpanded = expandedGroups.includes(groupKey);

                  const handleGroupToggle = (checked: boolean) => {
                    let newPermissions = [...formData.permissions];
                    if (checked) {
                      groupActions.forEach((p) => {
                        if (!newPermissions.includes(p)) newPermissions.push(p);
                      });
                      // Auto expand when selecting all
                      if (!expandedGroups.includes(groupKey)) {
                        setExpandedGroups((prev) => [...prev, groupKey]);
                      }
                    } else {
                      newPermissions = newPermissions.filter(
                        (p) => !groupActions.includes(p),
                      );
                    }
                    setFormData({ ...formData, permissions: newPermissions });
                  };

                  return (
                    <div
                      key={groupName}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200"
                    >
                      <div
                        className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <div className="flex items-center gap-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isGroupChecked}
                              ref={(input) => {
                                if (input)
                                  input.indeterminate = isGroupIndeterminate;
                              }}
                              onChange={(e) =>
                                handleGroupToggle(e.target.checked)
                              }
                              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                            />
                          </div>
                          <h3 className="font-semibold text-gray-800 dark:text-gray-200 capitalize select-none">
                            {groupName.toLowerCase().replace(/_/g, " ")}
                          </h3>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded-full">
                            {selectedGroupActions.length} /{" "}
                            {groupActions.length}
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
                          {resources.map((resource) => {
                            const capabilities =
                              getResourceCapabilities(resource);
                            const availableActions = ACTIONS.filter((action) =>
                              capabilities.includes(action as ResourceAction),
                            );

                            // Group actions
                            const crudActions = [
                              "read",
                              "create",
                              "update",
                              "delete",
                            ].filter((a) =>
                              availableActions.includes(a as ResourceAction),
                            );
                            const scopeActions = [
                              "site_only",
                              "department_only",
                            ].filter((a) =>
                              availableActions.includes(a as ResourceAction),
                            );
                            const specialActions = availableActions.filter(
                              (a) =>
                                ![
                                  "read",
                                  "create",
                                  "update",
                                  "delete",
                                  "site_only",
                                  "department_only",
                                ].includes(a),
                            );

                            // Check "All" status
                            const resourcePermissionIds = availableActions.map(
                              (action) => `${resource}:${action}`,
                            );
                            const isAllSelected = resourcePermissionIds.every(
                              (id) => formData.permissions.includes(id),
                            );

                            const toggleResourceAll = () => {
                              let newPermissions = [...formData.permissions];
                              if (isAllSelected) {
                                newPermissions = newPermissions.filter(
                                  (id) => !resourcePermissionIds.includes(id),
                                );
                              } else {
                                resourcePermissionIds.forEach((id) => {
                                  if (!newPermissions.includes(id))
                                    newPermissions.push(id);
                                });
                              }
                              setFormData({
                                ...formData,
                                permissions: newPermissions,
                              });
                            };

                            return (
                              <div
                                key={resource}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                              >
                                {/* Card Header */}
                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                                    {resource
                                      .replace(/^k_/, "")
                                      .replace(/_/g, " ")}
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
                                    {isAllSelected
                                      ? "Unselect All"
                                      : "Select All"}
                                  </button>
                                </div>

                                <div className="p-4 flex-1 flex flex-col gap-4">
                                  {/* 1. Basic CRUD Zone */}
                                  {crudActions.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                                        Basic Access
                                      </span>
                                      <div className="grid grid-cols-4 gap-2">
                                        {[
                                          "read",
                                          "create",
                                          "update",
                                          "delete",
                                        ].map((action) => {
                                          const isAvailable =
                                            crudActions.includes(action);
                                          if (!isAvailable)
                                            return (
                                              <div
                                                key={action}
                                                className="h-9 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700/50"
                                              ></div>
                                            );

                                          const permissionId = `${resource}:${action}`;
                                          const isSelected =
                                            formData.permissions.includes(
                                              permissionId,
                                            );

                                          // Icons mapping
                                          const icons: Record<
                                            string,
                                            React.ReactNode
                                          > = {
                                            read: <FiEye className="w-4 h-4" />,
                                            create: (
                                              <FiPlus className="w-4 h-4" />
                                            ),
                                            update: (
                                              <FiEdit2 className="w-4 h-4" />
                                            ),
                                            delete: (
                                              <FiTrash2 className="w-4 h-4" />
                                            ),
                                          };
                                          const labels: Record<string, string> =
                                            {
                                              read: "View",
                                              create: "Add",
                                              update: "Edit",
                                              delete: "Del",
                                            };

                                          return (
                                            <button
                                              key={action}
                                              type="button"
                                              onClick={() => {
                                                let newPerms = [
                                                  ...formData.permissions,
                                                ];
                                                if (isSelected)
                                                  newPerms = newPerms.filter(
                                                    (p) => p !== permissionId,
                                                  );
                                                else
                                                  newPerms.push(permissionId);
                                                setFormData({
                                                  ...formData,
                                                  permissions: newPerms,
                                                });
                                              }}
                                              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all h-full ${
                                                isSelected
                                                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                                                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                                              }`}
                                              title={action}
                                            >
                                              <span className="mb-1">
                                                {icons[action]}
                                              </span>
                                              <span className="text-[10px] font-medium">
                                                {labels[action]}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* 2. Special Actions Zone */}
                                  {specialActions.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                                        Special Actions
                                      </span>
                                      <div className="flex flex-wrap gap-2">
                                        {specialActions.map((action) => {
                                          const permissionId = `${resource}:${action}`;
                                          const isSelected =
                                            formData.permissions.includes(
                                              permissionId,
                                            );

                                          return (
                                            <button
                                              key={action}
                                              type="button"
                                              onClick={() => {
                                                let newPerms = [
                                                  ...formData.permissions,
                                                ];
                                                if (isSelected)
                                                  newPerms = newPerms.filter(
                                                    (p) => p !== permissionId,
                                                  );
                                                else
                                                  newPerms.push(permissionId);
                                                setFormData({
                                                  ...formData,
                                                  permissions: newPerms,
                                                });
                                              }}
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

                                  {/* 3. Scope Zone - Restrictions */}
                                  {scopeActions.length > 0 && (
                                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                      {/* Info banner explaining the counter-intuitive logic */}
                                      <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                                        <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                                          <strong>Info:</strong> Mengaktifkan
                                          pembatasan di bawah akan{" "}
                                          <strong>MEMBATASI</strong> user hanya
                                          ke data site/departemen mereka
                                          sendiri. Jika tidak diaktifkan, user
                                          bisa melihat <strong>semua</strong>{" "}
                                          data.
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        {scopeActions.map((action) => {
                                          const permissionId = `${resource}:${action}`;
                                          const isSelected =
                                            formData.permissions.includes(
                                              permissionId,
                                            );
                                          const scopeLabel =
                                            action === "site_only"
                                              ? "Site Sendiri"
                                              : "Departemen Sendiri";
                                          const scopeDescription =
                                            action === "site_only"
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
                                                    className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isSelected ? "left-4.5" : "left-0.5"}`}
                                                    style={{
                                                      left: isSelected
                                                        ? "calc(100% - 14px)"
                                                        : "2px",
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
                                                onChange={() => {
                                                  let newPerms = [
                                                    ...formData.permissions,
                                                  ];
                                                  if (isSelected)
                                                    newPerms = newPerms.filter(
                                                      (p) => p !== permissionId,
                                                    );
                                                  else
                                                    newPerms.push(permissionId);
                                                  setFormData({
                                                    ...formData,
                                                    permissions: newPerms,
                                                  });
                                                }}
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
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
          <Link
            href="/admin/pengaturan/hak-akses"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <FiSave />
            {saving ? "Menyimpan..." : "Simpan Role"}
          </button>
        </div>
      </form>
    </div>
  );
}
