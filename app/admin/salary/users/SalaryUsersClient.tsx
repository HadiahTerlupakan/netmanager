"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useCallback } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiOutlineClock,
  HiOutlineBanknotes,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/Modal";

interface User {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  basicSalary: number | null;
  overtimeRateNormal: number | null;
  overtimeCalcTypeNormal?: string | null;
  overtimeRateHoliday: number | null;
  overtimeCalcTypeHoliday?: string | null;
  overtimeRateNational: number | null;
  overtimeCalcTypeNational?: string | null;
  woIncentiveRate: number | null;
  payPeriodDay: number;
  payDay: number;
  lateDeductionRate: number | null;
  absentDeductionRate: number | null;
  departments?: { name: string } | null;
  role?: { name: string } | null;
  joinDate: string | null;
  ptkpStatus: string | null;
  bpjsKesehatan: boolean;
  bpjsKetenagakerjaan: boolean;
}

interface SalaryComponent {
  id: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  rateType?: "FIXED" | "PERCENTAGE";
  defaultAmount: number;
}

interface UserSalaryComponent {
  id: string;
  userId: string;
  componentId: string;
  amount: number;
  notes: string | null;
  component: SalaryComponent;
}

export default function SalaryUsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userComponents, setUserComponents] = useState<UserSalaryComponent[]>(
    [],
  );
  const [_components, setComponents] = useState<SalaryComponent[]>([]);

  // Form states untuk tambah karyawan
  const [selectedUserId, setSelectedUserId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [employeeType, setEmployeeType] = useState("KARYAWAN");
  const [overtimeRateNormal, setOvertimeRateNormal] = useState("");
  const [overtimeCalcTypeNormal, setOvertimeCalcTypeNormal] =
    useState("PER_HOUR");
  const [payPeriodDay, setPayPeriodDay] = useState(25);
  const [payDay, setPayDay] = useState(1);
  const [overtimeRateHoliday, setOvertimeRateHoliday] = useState("");
  const [overtimeCalcTypeHoliday, setOvertimeCalcTypeHoliday] =
    useState("PER_HOUR");
  const [overtimeRateNational, setOvertimeRateNational] = useState("");
  const [overtimeCalcTypeNational, setOvertimeCalcTypeNational] =
    useState("PER_HOUR");
  const [woIncentiveRate, setWoIncentiveRate] = useState("");
  const [lateDeductionRate, setLateDeductionRate] = useState("");
  const [absentDeductionRate, setAbsentDeductionRate] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [ptkpStatus, setPtkpStatus] = useState("TK_0");
  const [bpjsKesehatan, setBpjsKesehatan] = useState(false);
  const [bpjsKetenagakerjaan, setBpjsKetenagakerjaan] = useState(false);
  const [pendingComponents, setPendingComponents] = useState<
    {
      name: string;
      type: "EARNING" | "DEDUCTION";
      rateType: "FIXED" | "PERCENTAGE";
      amount: number;
      notes: string;
    }[]
  >([]);

  // Form states untuk komponen dicover oleh newComponent* states di atas
  // const [selectedComponentId, setSelectedComponentId] = useState('')
  // const [componentAmount, setComponentAmount] = useState('')
  // const [componentNotes, setComponentNotes] = useState('')

  // Form states untuk komponen di form tambah (input langsung)
  const [newComponentName, setNewComponentName] = useState("");
  const [newComponentType, setNewComponentType] = useState<
    "EARNING" | "DEDUCTION"
  >("EARNING");
  const [newComponentRateType, setNewComponentRateType] = useState<
    "FIXED" | "PERCENTAGE"
  >("FIXED");
  const [newComponentAmount, setNewComponentAmount] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/salary/users");
      const data = await res.json();
      setUsers(data.data?.users || data.users || []);
      setAllUsers(data.data?.allUsers || data.allUsers || []);
    } catch (error) {
      clientLogger.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComponents = async () => {
    try {
      const res = await fetch("/api/admin/salary/components");
      const data = await res.json();
      setComponents(data.data?.components || data.components || []);
    } catch (error) {
      clientLogger.error("Error:", error);
    }
  };

  const fetchUserComponents = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/salary/users/${userId}/components`);
      const data = await res.json();
      setUserComponents(data.data?.components || data.components || []);
    } catch (error) {
      clientLogger.error("Error:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchComponents();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/salary/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          basicSalary: parseFloat(basicSalary) || 0,
          employeeType,
          overtimeRateNormal: overtimeRateNormal
            ? parseFloat(overtimeRateNormal)
            : null,
          overtimeCalcTypeNormal,
          overtimeRateHoliday: overtimeRateHoliday
            ? parseFloat(overtimeRateHoliday)
            : null,
          overtimeCalcTypeHoliday,
          overtimeRateNational: overtimeRateNational
            ? parseFloat(overtimeRateNational)
            : null,
          overtimeCalcTypeNational,
          woIncentiveRate: woIncentiveRate ? parseFloat(woIncentiveRate) : null,
          payPeriodDay: payPeriodDay,
          payDay: payDay,
          lateDeductionRate: lateDeductionRate
            ? parseFloat(lateDeductionRate)
            : null,
          absentDeductionRate: absentDeductionRate
            ? parseFloat(absentDeductionRate)
            : null,
          joinDate: joinDate || null,
          ptkpStatus: ptkpStatus || null,
          bpjsKesehatan,
          bpjsKetenagakerjaan,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Create and assign pending components to the newly added user
        for (const comp of pendingComponents) {
          // First, create the component
          const createRes = await fetch("/api/admin/salary/components", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: comp.name,
              type: comp.type,
              rateType: comp.rateType,
              defaultAmount: comp.amount,
            }),
          });
          const createJson = await createRes.json();
          const createData = createJson.data || createJson;

          if (createJson.success && createData.component) {
            // Then assign to user with action='assign'
            await fetch("/api/admin/salary/components", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "assign",
                userId: selectedUserId,
                componentId: createData.component.id,
                amount: comp.amount,
                notes: comp.notes,
              }),
            });
          }
        }
        setShowAddModal(false);
        resetForm();
        fetchUsers();
        fetchComponents();
      } else {
        alert(data.error || "Gagal menambahkan");
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      alert("Terjadi kesalahan");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/admin/salary/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicSalary: parseFloat(editForm.basicSalary) || 0,
          employeeType: editForm.employeeType,
          overtimeRateNormal: editForm.overtimeRateNormal
            ? parseFloat(editForm.overtimeRateNormal)
            : null,
          overtimeCalcTypeNormal: editForm.overtimeCalcTypeNormal,
          overtimeRateHoliday: editForm.overtimeRateHoliday
            ? parseFloat(editForm.overtimeRateHoliday)
            : null,
          overtimeCalcTypeHoliday: editForm.overtimeCalcTypeHoliday,
          overtimeRateNational: editForm.overtimeRateNational
            ? parseFloat(editForm.overtimeRateNational)
            : null,
          overtimeCalcTypeNational: editForm.overtimeCalcTypeNational,
          woIncentiveRate: editForm.woIncentiveRate
            ? parseFloat(editForm.woIncentiveRate)
            : null,
          payPeriodDay: editForm.payPeriodDay,
          payDay: editForm.payDay,
          lateDeductionRate: editForm.lateDeductionRate
            ? parseFloat(editForm.lateDeductionRate)
            : null,
          absentDeductionRate: editForm.absentDeductionRate
            ? parseFloat(editForm.absentDeductionRate)
            : null,
          joinDate: editForm.joinDate || null,
          ptkpStatus: editForm.ptkpStatus || null,
          bpjsKesehatan: editForm.bpjsKesehatan,
          bpjsKetenagakerjaan: editForm.bpjsKetenagakerjaan,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        setShowEditModal(false);
        alert("Data karyawan berhasil diperbarui");
      } else {
        alert(data.error || "Gagal memperbarui data");
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      alert("Terjadi kesalahan saat menyimpan data");
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setBasicSalary("");
    setEmployeeType("KARYAWAN");
    setOvertimeRateNormal("");
    setOvertimeCalcTypeNormal("PER_HOUR");
    setOvertimeRateHoliday("");
    setOvertimeCalcTypeHoliday("PER_HOUR");
    setOvertimeRateNational("");
    setOvertimeCalcTypeNational("PER_HOUR");
    setWoIncentiveRate("");
    setPayPeriodDay(25);
    setPayDay(1);
    setLateDeductionRate("");
    setAbsentDeductionRate("");
    setPendingComponents([]);
    setNewComponentName("");
    setNewComponentType("EARNING");
    setNewComponentRateType("FIXED");
    setNewComponentAmount("");
    setJoinDate("");
    setPtkpStatus("TK_0");
    setBpjsKesehatan(false);
    setBpjsKetenagakerjaan(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Hapus user ini dari daftar gaji?")) return;
    try {
      await fetch(`/api/admin/salary/users/${userId}`, { method: "DELETE" });
      fetchUsers();
    } catch (error) {
      clientLogger.error("Error:", error);
    }
  };

  // State untuk edit form
  const [editForm, setEditForm] = useState({
    basicSalary: "",
    employeeType: "KARYAWAN",
    overtimeRateNormal: "",
    overtimeCalcTypeNormal: "PER_HOUR",
    overtimeRateHoliday: "",
    overtimeCalcTypeHoliday: "PER_HOUR",
    overtimeRateNational: "",
    overtimeCalcTypeNational: "PER_HOUR",
    woIncentiveRate: "",
    lateDeductionRate: "",
    absentDeductionRate: "",
    payPeriodDay: 25,
    payDay: 1,
    joinDate: "",
    ptkpStatus: "TK_0",
    bpjsKesehatan: false,
    bpjsKetenagakerjaan: false,
  });

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      basicSalary: user.basicSalary?.toString() || "",
      employeeType: user.employeeType || "KARYAWAN",
      overtimeRateNormal: user.overtimeRateNormal?.toString() || "",
      overtimeCalcTypeNormal: user.overtimeCalcTypeNormal || "PER_HOUR",
      overtimeRateHoliday: user.overtimeRateHoliday?.toString() || "",
      overtimeCalcTypeHoliday: user.overtimeCalcTypeHoliday || "PER_HOUR",
      overtimeRateNational: user.overtimeRateNational?.toString() || "",
      overtimeCalcTypeNational: user.overtimeCalcTypeNational || "PER_HOUR",
      woIncentiveRate: user.woIncentiveRate?.toString() || "",
      lateDeductionRate: user.lateDeductionRate?.toString() || "",
      absentDeductionRate: user.absentDeductionRate?.toString() || "",
      payPeriodDay: user.payPeriodDay || 25,
      payDay: user.payDay || 1,
      joinDate: user.joinDate
        ? new Date(user.joinDate).toISOString().split("T")[0]
        : "",
      ptkpStatus: user.ptkpStatus || "TK_0",
      bpjsKesehatan: user.bpjsKesehatan || false,
      bpjsKetenagakerjaan: user.bpjsKetenagakerjaan || false,
    });
    setShowEditModal(true);
    fetchUserComponents(user.id);
  };

  const handleCreateAndAssignComponent = async () => {
    if (!selectedUser) return;
    if (!newComponentName || !newComponentAmount) {
      alert("Nama komponen dan jumlah harus diisi");
      return;
    }

    try {
      // 1. Create the component first
      const createRes = await fetch("/api/admin/salary/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newComponentName,
          type: newComponentType,
          rateType: newComponentRateType,
          defaultAmount: parseFloat(newComponentAmount) || 0,
        }),
      });
      const createData = await createRes.json();

      if (createData.success && createData.component) {
        // 2. Assign to user
        const assignRes = await fetch(
          `/api/admin/salary/users/${selectedUser.id}/components`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              componentId: createData.component.id,
              amount: parseFloat(newComponentAmount) || 0,
              notes: "", // Notes field was removed from refined UI to match Add Modal simple style
            }),
          },
        );
        const assignData = await assignRes.json();

        if (assignData.success) {
          setNewComponentName("");
          setNewComponentAmount("");
          setNewComponentType("EARNING");
          setNewComponentRateType("FIXED");
          fetchUserComponents(selectedUser.id);
        } else {
          alert(assignData.error || "Gagal menambahkan ke user");
        }
      } else {
        alert(createData.error || "Gagal membuat komponen");
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      alert("Terjadi kesalahan");
    }
  };

  const handleRemoveComponent = async (userComponentId: string) => {
    if (!selectedUser) return;
    if (!confirm("Hapus komponen ini?")) return;
    try {
      await fetch(
        `/api/admin/salary/users/${selectedUser.id}/components/${userComponentId}`,
        {
          method: "DELETE",
        },
      );
      fetchUserComponents(selectedUser.id);
    } catch (error) {
      clientLogger.error("Error:", error);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Filter users that not yet in salary list
  const availableUsers = allUsers.filter(
    (u) => !users.find((su) => su.id === u.id),
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Karyawan Digaji
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Kelola daftar karyawan dan komponen gaji mereka
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4 mr-2" />
          Tambah Karyawan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <HiOutlineUsers className="w-8 h-8 text-indigo-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {users.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Karyawan
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <HiOutlineCurrencyDollar className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(
                    users.reduce((sum, u) => sum + (u.basicSalary || 0), 0),
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Gaji Pokok
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Daftar Karyawan
            </CardTitle>
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                {users.length} Karyawan
              </span>
            </div>
          </div>
        </CardHeader>
        <div className="bg-white dark:bg-gray-900">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                Memuat data...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <HiOutlineUsers className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-gray-200 font-medium mb-1">
                Daftar Kosong
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
                Belum ada karyawan yang ditambahkan ke daftar gaji.
              </p>
              <Button onClick={() => setShowAddModal(true)} className="mt-4">
                + Tambah Karyawan Sekarang
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="py-3 px-6 font-medium text-gray-500 dark:text-gray-400 w-[300px]">
                      KARYAWAN
                    </th>
                    <th className="py-3 px-6 font-medium text-gray-500 dark:text-gray-400">
                      DEPARTEMEN
                    </th>
                    <th className="py-3 px-6 font-medium text-gray-500 dark:text-gray-400">
                      STATUS
                    </th>
                    <th className="py-3 px-6 font-medium text-gray-500 dark:text-gray-400 text-right">
                      GAJI POKOK
                    </th>
                    <th className="py-3 px-6 font-medium text-gray-500 dark:text-gray-400 text-center w-[100px]">
                      AKSI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map((user) => {
                    // Generate avatar color based on name length
                    const colors = [
                      "bg-blue-100 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                      "bg-purple-100 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
                      "bg-emerald-100 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                      "bg-amber-100 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                      "bg-rose-100 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
                      "bg-indigo-100 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
                    ];
                    const colorIndex = (user.name?.length || 0) % colors.length;
                    const avatarColor = colors[colorIndex];
                    const initials = (user.name || "?")
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={user.id}
                        className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <Link
                            href={`/admin/salary/users/${user.id}`}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border ${avatarColor} dark:bg-opacity-20 dark:border-opacity-20 group-hover:ring-2 ring-indigo-100 dark:ring-indigo-900 transition-all`}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {user.name || "Tanpa Nama"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                {user.email}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            {user.departments ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                {user.departments.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">
                                -
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {user.employeeType === "KARYAWAN" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Karyawan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {user.employeeType}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="font-mono text-gray-700 dark:text-gray-200 font-medium">
                            {formatCurrency(user.basicSalary)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/admin/salary/users/${user.id}`}
                              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                              title="Lihat Detail"
                            >
                              <HiOutlineEye className="w-4 h-4" />
                            </Link>
                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                            <Button
                              onClick={() => openEditModal(user)}
                              className="p-1.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 rounded-lg transition-colors"
                              title="Edit Konfigurasi"
                            >
                              <HiOutlinePencil className="w-4 h-4" />
                            </Button>
                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                              title="Hapus dari Daftar"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Karyawan ke Daftar Gaji"
        description="Atur konfigurasi penggajian untuk karyawan"
        size="2xl"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          {/* Pilih Karyawan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Pilih Karyawan *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              >
                <option value="">-- Pilih Karyawan --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tipe Karyawan *
              </label>
              <select
                value={employeeType}
                onChange={(e) => setEmployeeType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              >
                <option value="KARYAWAN">Karyawan</option>
                <option value="MITRA_TEKNISI">Mitra Teknisi</option>
                <option value="MITRA_SALES">Mitra Sales</option>
              </select>
            </div>
          </div>

          {/* Prorate & Tax Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tanggal Masuk (Join Date) *
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Digunakan untuk hitungan gaji prorat bulan pertama.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Status PTKP (Pajak)
              </label>
              <select
                value={ptkpStatus}
                onChange={(e) => setPtkpStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="TK_0">TK/0 (Lajang)</option>
                <option value="TK_1">TK/1</option>
                <option value="TK_2">TK/2</option>
                <option value="TK_3">TK/3</option>
                <option value="K_0">K/0 (Menikah)</option>
                <option value="K_1">K/1</option>
                <option value="K_2">K/2</option>
                <option value="K_3">K/3</option>
              </select>
            </div>
          </div>

          {/* BPJS Config */}
          <div className="flex gap-6 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bpjsKesehatan}
                onChange={(e) => setBpjsKesehatan(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Potong BPJS Kesehatan (1%)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bpjsKetenagakerjaan}
                onChange={(e) => setBpjsKetenagakerjaan(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Potong BPJS TK (3%)
              </span>
            </label>
          </div>

          {/* Gaji Pokok */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Gaji Pokok (Rp) *
            </label>
            <input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
              placeholder="0"
              required
            />
          </div>

          {/* Siklus Gaji & Cutoff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-emerald-600 dark:text-emerald-400">
                Tanggal Cutoff (Siklus) *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={payPeriodDay}
                onChange={(e) => setPayPeriodDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 border-2 border-emerald-100 rounded-lg dark:bg-gray-700 dark:border-emerald-900/30 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tanggal Gajian *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={payDay}
                onChange={(e) => setPayDay(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Rate Lembur - Compact Grid */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4 mt-4">
            <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                <HiOutlineClock className="w-3 h-3" />
              </span>
              Rate Lembur
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Hari Biasa */}
              <div className="bg-gray-50/80 dark:bg-gray-800/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Hari Biasa
                  </span>
                  <select
                    value={overtimeCalcTypeNormal}
                    onChange={(e) => setOvertimeCalcTypeNormal(e.target.value)}
                    className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="PER_HOUR">/Jam</option>
                    <option value="FIXED">/Hari</option>
                    <option value="DAILY_SALARY">/Shift</option>
                    <option value="PERCENTAGE">%</option>
                  </select>
                </div>
                <input
                  type="number"
                  value={overtimeRateNormal}
                  onChange={(e) => setOvertimeRateNormal(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder={
                    overtimeCalcTypeNormal === "PERCENTAGE" ? "1.5" : "50000"
                  }
                />
              </div>

              {/* Hari Libur */}
              <div className="bg-orange-50/80 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    Hari Libur
                  </span>
                  <select
                    value={overtimeCalcTypeHoliday}
                    onChange={(e) => setOvertimeCalcTypeHoliday(e.target.value)}
                    className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="PER_HOUR">/Jam</option>
                    <option value="FIXED">/Hari</option>
                    <option value="DAILY_SALARY">/Shift</option>
                    <option value="PERCENTAGE">%</option>
                  </select>
                </div>
                <input
                  type="number"
                  value={overtimeRateHoliday}
                  onChange={(e) => setOvertimeRateHoliday(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder={
                    overtimeCalcTypeHoliday === "PERCENTAGE" ? "2" : "75000"
                  }
                />
              </div>

              {/* Libur Nasional */}
              <div className="bg-red-50/80 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    Libur Nasional
                  </span>
                  <select
                    value={overtimeCalcTypeNational}
                    onChange={(e) =>
                      setOvertimeCalcTypeNational(e.target.value)
                    }
                    className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="PER_HOUR">/Jam</option>
                    <option value="FIXED">/Hari</option>
                    <option value="DAILY_SALARY">/Shift</option>
                    <option value="PERCENTAGE">%</option>
                  </select>
                </div>
                <input
                  type="number"
                  value={overtimeRateNational}
                  onChange={(e) => setOvertimeRateNational(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder={
                    overtimeCalcTypeNational === "PERCENTAGE" ? "3" : "100000"
                  }
                />
              </div>
            </div>
          </div>

          {/* Insentif & Potongan */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
            <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 dark:text-purple-400">
                <HiOutlineBanknotes className="w-3 h-3" />
              </span>
              Insentif & Potongan
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50/60 dark:bg-green-900/10 p-2.5 rounded-lg border border-green-100 dark:border-green-700/20">
                <label className="block text-xs text-green-600 dark:text-green-400 mb-1 font-medium">
                  +Insentif WO
                </label>
                <input
                  type="number"
                  value={woIncentiveRate}
                  onChange={(e) => setWoIncentiveRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="25000"
                />
              </div>
              <div className="bg-red-50/60 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-100 dark:border-red-700/20">
                <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                  -Telat
                </label>
                <input
                  type="number"
                  value={lateDeductionRate}
                  onChange={(e) => setLateDeductionRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="25000"
                />
              </div>
              <div className="bg-red-50/60 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-100 dark:border-red-700/20">
                <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                  -Alpha
                </label>
                <input
                  type="number"
                  value={absentDeductionRate}
                  onChange={(e) => setAbsentDeductionRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="100000"
                />
              </div>
            </div>
          </div>

          {/* Komponen Gaji Tambahan */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
            <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                <HiOutlineDocumentText className="w-3 h-3" />
              </span>
              Komponen Gaji Tambahan
              <span className="text-xs text-gray-400 font-normal">
                (opsional)
              </span>
            </h4>

            {/* Pending Components List */}
            {pendingComponents.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {pendingComponents.map((pc, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-200 hover:shadow-md border ${
                      pc.type === "EARNING"
                        ? "bg-linear-to-r from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border-green-200/60 dark:border-green-700/40 hover:border-green-300"
                        : "bg-linear-to-r from-red-50 to-rose-50/50 dark:from-red-900/20 dark:to-rose-900/10 border-red-200/60 dark:border-red-700/40 hover:border-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          pc.type === "EARNING"
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {pc.type === "EARNING" ? "+" : "-"}
                      </span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {pc.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          pc.rateType === "PERCENTAGE"
                            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {pc.rateType === "PERCENTAGE" ? "%" : "Fix"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          pc.type === "EARNING"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {pc.rateType === "PERCENTAGE"
                          ? `${pc.amount}%`
                          : `Rp ${pc.amount.toLocaleString("id-ID")}`}
                      </span>
                      <Button
                        type="button"
                        onClick={() =>
                          setPendingComponents((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                      >
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Component Form - Direct Input */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  placeholder="Nama komponen (mis: Tunjangan Transport)"
                  className="col-span-4 px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                />
                <select
                  value={newComponentType}
                  onChange={(e) =>
                    setNewComponentType(
                      e.target.value as "EARNING" | "DEDUCTION",
                    )
                  }
                  className="col-span-2 px-2 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="EARNING">+ Pendapatan</option>
                  <option value="DEDUCTION">- Potongan</option>
                </select>
                <select
                  value={newComponentRateType}
                  onChange={(e) =>
                    setNewComponentRateType(
                      e.target.value as "FIXED" | "PERCENTAGE",
                    )
                  }
                  className="col-span-2 px-2 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="FIXED">Fix (Rp)</option>
                  <option value="PERCENTAGE">% Gaji</option>
                </select>
                <input
                  type="number"
                  value={newComponentAmount}
                  onChange={(e) => setNewComponentAmount(e.target.value)}
                  placeholder={
                    newComponentRateType === "PERCENTAGE" ? "5 (5%)" : "500000"
                  }
                  className="col-span-3 px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newComponentName && newComponentAmount) {
                      setPendingComponents((prev) => [
                        ...prev,
                        {
                          name: newComponentName,
                          type: newComponentType,
                          rateType: newComponentRateType,
                          amount: parseFloat(newComponentAmount) || 0,
                          notes: "",
                        },
                      ]);
                      setNewComponentName("");
                      setNewComponentAmount("");
                      setNewComponentRateType("FIXED");
                    }
                  }}
                  className="col-span-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm flex items-center justify-center"
                >
                  <HiOutlinePlus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Contoh: Tunjangan Transport (Fix), BPJS (% Gaji), dll.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            * Semua field rate wajib diisi untuk kalkulasi gaji
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              Tambah
            </Button>
            <Button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Component Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Komponen Gaji - ${selectedUser?.name || ""}`}
        description="Kelola komponen gaji custom untuk karyawan ini"
        size="2xl"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Basic Info */}
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Tipe Karyawan
                </label>
                <select
                  value={editForm.employeeType}
                  onChange={(e) =>
                    setEditForm({ ...editForm, employeeType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="KARYAWAN">Karyawan</option>
                  <option value="MITRA_TEKNISI">Mitra Teknisi</option>
                  <option value="MITRA_SALES">Mitra Sales</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Gaji Pokok (Rp)
                </label>
                <input
                  type="text"
                  value={
                    editForm.basicSalary
                      ? Number(editForm.basicSalary).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setEditForm({ ...editForm, basicSalary: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cutoff & Pay Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-emerald-600 dark:text-emerald-400">
                  Tanggal Cutoff (Siklus)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editForm.payPeriodDay}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      payPeriodDay: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border-2 border-emerald-100 rounded-lg dark:bg-gray-700 dark:border-emerald-900/30 font-semibold text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Tanggal Gajian
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editForm.payDay}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      payDay: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Prorate & Tax Config Edit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Tanggal Masuk (Join Date) *
                </label>
                <input
                  type="date"
                  value={editForm.joinDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, joinDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Status PTKP (Pajak)
                </label>
                <select
                  value={editForm.ptkpStatus}
                  onChange={(e) =>
                    setEditForm({ ...editForm, ptkpStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="TK_0">TK/0 (Lajang)</option>
                  <option value="TK_1">TK/1</option>
                  <option value="TK_2">TK/2</option>
                  <option value="TK_3">TK/3</option>
                  <option value="K_0">K/0 (Menikah)</option>
                  <option value="K_1">K/1</option>
                  <option value="K_2">K/2</option>
                  <option value="K_3">K/3</option>
                </select>
              </div>
            </div>

            {/* BPJS Config Edit */}
            <div className="flex gap-6 mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.bpjsKesehatan}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      bpjsKesehatan: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Potong BPJS Kesehatan (1%)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.bpjsKetenagakerjaan}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      bpjsKetenagakerjaan: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Potong BPJS TK (3%)
                </span>
              </label>
            </div>

            {/* Overtime Rates */}
            <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4 mt-4">
              <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                  <HiOutlineClock className="w-3 h-3" />
                </span>
                Rate Lembur
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Hari Biasa */}
                <div className="bg-gray-50/80 dark:bg-gray-800/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Hari Biasa
                    </span>
                    <select
                      value={editForm.overtimeCalcTypeNormal || "PER_HOUR"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          overtimeCalcTypeNormal: e.target.value,
                        })
                      }
                      className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="PER_HOUR">/Jam</option>
                      <option value="FIXED">/Hari</option>
                      <option value="DAILY_SALARY">/Shift</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={
                      editForm.overtimeRateNormal
                        ? Number(editForm.overtimeRateNormal).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        overtimeRateNormal: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder={
                      editForm.overtimeCalcTypeNormal === "PERCENTAGE"
                        ? "1.5"
                        : "50000"
                    }
                  />
                </div>

                {/* Hari Libur */}
                <div className="bg-orange-50/80 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      Hari Libur
                    </span>
                    <select
                      value={editForm.overtimeCalcTypeHoliday || "PER_HOUR"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          overtimeCalcTypeHoliday: e.target.value,
                        })
                      }
                      className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="PER_HOUR">/Jam</option>
                      <option value="FIXED">/Hari</option>
                      <option value="DAILY_SALARY">/Shift</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={
                      editForm.overtimeRateHoliday
                        ? Number(editForm.overtimeRateHoliday).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        overtimeRateHoliday: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder={
                      editForm.overtimeCalcTypeHoliday === "PERCENTAGE"
                        ? "2"
                        : "75000"
                    }
                  />
                </div>

                {/* Libur Nasional */}
                <div className="bg-red-50/80 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Libur Nasional
                    </span>
                    <select
                      value={editForm.overtimeCalcTypeNational || "PER_HOUR"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          overtimeCalcTypeNational: e.target.value,
                        })
                      }
                      className="px-1.5 py-0.5 border border-gray-200 rounded text-[10px] bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="PER_HOUR">/Jam</option>
                      <option value="FIXED">/Hari</option>
                      <option value="DAILY_SALARY">/Shift</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={
                      editForm.overtimeRateNational
                        ? Number(editForm.overtimeRateNational).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        overtimeRateNational: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder={
                      editForm.overtimeCalcTypeNational === "PERCENTAGE"
                        ? "3"
                        : "100000"
                    }
                  />
                </div>
              </div>
            </div>

            {/* Incentives & Deductions */}
            <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
              <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 dark:text-purple-400">
                  <HiOutlineBanknotes className="w-3 h-3" />
                </span>
                Insentif & Potongan
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Insentif WO */}
                <div className="bg-green-50/60 dark:bg-green-900/10 p-2.5 rounded-lg border border-green-100 dark:border-green-700/20">
                  <label className="block text-xs text-green-600 dark:text-green-400 mb-1 font-medium">
                    +Insentif WO
                  </label>
                  <input
                    type="text"
                    value={
                      editForm.woIncentiveRate
                        ? Number(editForm.woIncentiveRate).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        woIncentiveRate: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="0"
                  />
                </div>

                {/* Potongan Telat */}
                <div className="bg-red-50/60 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-100 dark:border-red-700/20">
                  <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                    -Telat
                  </label>
                  <input
                    type="text"
                    value={
                      editForm.lateDeductionRate
                        ? Number(editForm.lateDeductionRate).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        lateDeductionRate: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="0"
                  />
                </div>

                {/* Potongan Alpha */}
                <div className="bg-red-50/60 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-100 dark:border-red-700/20">
                  <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                    -Alpha
                  </label>
                  <input
                    type="text"
                    value={
                      editForm.absentDeductionRate
                        ? Number(editForm.absentDeductionRate).toLocaleString(
                            "id-ID",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        absentDeductionRate: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Komponen Gaji Tambahan Section */}
            <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
              <h4 className="font-medium mb-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                  <HiOutlineDocumentText className="w-3 h-3" />
                </span>
                Kelola Komponen Gaji Tambahan
              </h4>

              <div className="space-y-4">
                {/* Existing Components List - Moved to Top */}
                <div className="space-y-2">
                  {userComponents.length > 0 ? (
                    userComponents.map((uc) => (
                      <div
                        key={uc.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-200 hover:shadow-md border ${
                          uc.component.type === "EARNING"
                            ? "bg-linear-to-r from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border-green-200/60 dark:border-green-700/40 hover:border-green-300"
                            : "bg-linear-to-r from-red-50 to-rose-50/50 dark:from-red-900/20 dark:to-rose-900/10 border-red-200/60 dark:border-red-700/40 hover:border-red-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              uc.component.type === "EARNING"
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {uc.component.type === "EARNING" ? "+" : "-"}
                          </span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            {uc.component.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              uc.component.rateType === "PERCENTAGE"
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {uc.component.rateType === "PERCENTAGE"
                              ? "%"
                              : "Fix"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              uc.component.type === "EARNING"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {uc.component.rateType === "PERCENTAGE"
                              ? `${uc.amount}%`
                              : formatCurrency(uc.amount)}
                          </span>
                          <Button
                            onClick={() => handleRemoveComponent(uc.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                          >
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-center">
                      <p className="text-yellow-700 dark:text-yellow-300">
                        Belum ada komponen aktif.
                      </p>
                    </div>
                  )}
                </div>

                {/* Add Component Form - Direct Input (Matches Add Modal Grid Exactly) */}
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newComponentName}
                      onChange={(e) => setNewComponentName(e.target.value)}
                      placeholder="Nama komponen"
                      className="col-span-4 px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    />
                    <select
                      value={newComponentType}
                      onChange={(e) =>
                        setNewComponentType(
                          e.target.value as "EARNING" | "DEDUCTION",
                        )
                      }
                      className="col-span-2 px-2 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="EARNING">+ Pend</option>
                      <option value="DEDUCTION">- Pot</option>
                    </select>
                    <select
                      value={newComponentRateType}
                      onChange={(e) =>
                        setNewComponentRateType(
                          e.target.value as "FIXED" | "PERCENTAGE",
                        )
                      }
                      className="col-span-2 px-2 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="FIXED">Fix (Rp)</option>
                      <option value="PERCENTAGE">% Gaji</option>
                    </select>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={
                          newComponentAmount
                            ? newComponentRateType === "PERCENTAGE"
                              ? newComponentAmount
                              : Number(newComponentAmount).toLocaleString(
                                  "id-ID",
                                )
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (newComponentRateType === "PERCENTAGE") {
                            setNewComponentAmount(val.replace(/[^\d.]/g, ""));
                          } else {
                            setNewComponentAmount(val.replace(/\D/g, ""));
                          }
                        }}
                        placeholder={
                          newComponentRateType === "PERCENTAGE"
                            ? "5"
                            : "500.000"
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleCreateAndAssignComponent}
                      className="col-span-1"
                      title="Tambah Komponen"
                    >
                      <HiOutlinePlus className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Komponen yang ditambahkan akan langsung disimpan.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions - Matching Add Modal */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                onClick={handleUpdateUser}
                className="flex-1"
              >
                <HiOutlineCheckCircle className="w-5 h-5" />
                Simpan Perubahan
              </Button>
              <Button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
