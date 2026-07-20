import Link from "next/link";
import {
  HiOutlineIdentification,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
} from "react-icons/hi2";
import { ensurePermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "HR - Admin Portal",
};

const CARDS = [
  {
    href: "/admin/hr/employees",
    title: "Data Pegawai",
    description:
      "Departemen, site, jam kerja, dan kuota cuti. Akun login ada di menu Pengguna.",
    icon: HiOutlineIdentification,
  },
  {
    href: "/admin/users",
    title: "Akun Pengguna",
    description: "Email, role, password, status aktif, dan force logout.",
    icon: HiOutlineUsers,
  },
  {
    href: "/admin/kehadiran",
    title: "Kehadiran",
    description:
      "Absensi, shift, lembur, izin, dan hari libur (menu terpisah).",
    icon: HiOutlineClipboardDocumentCheck,
  },
  {
    href: "/admin/salary",
    title: "Penggajian",
    description: "Payroll dan profil gaji (menu terpisah).",
    icon: HiOutlineCurrencyDollar,
  },
] as const;

export default async function HrLandingPage() {
  await ensurePermission("users:read");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pusat data kepegawaian. Kehadiran dan penggajian tetap di menu
          masing-masing.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="block p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <Icon className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
