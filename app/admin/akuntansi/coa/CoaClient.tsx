"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  HiPlus,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineRectangleStack,
  HiChevronRight,
  HiChevronDown,
} from "react-icons/hi2";
import { Modal, ModalBody } from "@/components/ui/Modal";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";

interface Coa {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  normalSide: string;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
  parentId: string | null;
  balance?: number;
}

interface TreeNode extends Coa {
  children: TreeNode[];
  level: number;
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  LIABILITY:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  EQUITY:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  REVENUE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  EXPENSE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

const TYPE_ACCENT: Record<string, string> = {
  ASSET: "text-blue-600 dark:text-blue-400",
  LIABILITY: "text-orange-600 dark:text-orange-400",
  EQUITY: "text-purple-600 dark:text-purple-400",
  REVENUE: "text-green-600 dark:text-green-400",
  EXPENSE: "text-red-600 dark:text-red-400",
};

function buildTree(items: Coa[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [], level: 0 });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const setLevels = (nodes: TreeNode[], level: number) => {
    for (const n of nodes) {
      n.level = level;
      setLevels(n.children, level + 1);
    }
  };
  setLevels(roots, 0);

  const sortByCode = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of nodes) sortByCode(n.children);
  };
  sortByCode(roots);

  return roots;
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

const SUBTYPE_LABELS: Record<string, { label: string; classes: string }> = {
  FIXED_ASSET: {
    label: "CAPEX",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  OPEX: {
    label: "OPEX",
    classes: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  COGS: {
    label: "COGS",
    classes: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
  CURRENT_ASSET: {
    label: "Lancar",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  CURRENT_LIABILITY: {
    label: "Lancar",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  LONG_TERM_LIABILITY: {
    label: "Jk. Panjang",
    classes:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  CONTRIBUTED_CAPITAL: {
    label: "Modal",
    classes:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  RETAINED_EARNINGS: {
    label: "Laba Ditahan",
    classes:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  OPERATING_REVENUE: {
    label: "Operasional",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  OTHER_REVENUE: {
    label: "Lainnya",
    classes:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  OTHER_EXPENSE: {
    label: "Lainnya",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

function renderSubtypeBadge(subtype: string | null) {
  if (!subtype) return null;
  const cfg = SUBTYPE_LABELS[subtype];
  if (!cfg)
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        {subtype}
      </span>
    );
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

export function CoaClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("coa:create");
  const canDelete = hasPermission("coa:delete");
  const canEdit = hasPermission("coa:manage");

  const [items, setItems] = useState<Coa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterSubtype, setFilterSubtype] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Coa | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    subtype: "",
    isActive: true,
  });
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    subtype: "",
    parentId: "",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    params.set("includeBalance", "true");
    const res = await fetch(`/api/admin/accounting/coa?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
    }
    setLoading(false);
  }, [filterType]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter((i) => i.type === filterType);
    if (filterSubtype)
      result = result.filter((i) => i.subtype === filterSubtype);
    if (filterStatus === "active") result = result.filter((i) => i.isActive);
    if (filterStatus === "inactive") result = result.filter((i) => !i.isActive);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, filterType, filterSubtype, filterStatus, searchQuery]);

  const tree = useMemo(() => buildTree(filteredItems), [filteredItems]);
  const flatList = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allParentIds = items
      .filter((i) => items.some((c) => c.parentId === i.id))
      .map((i) => i.id);
    setExpanded(new Set(allParentIds));
  };

  const collapseAll = () => setExpanded(new Set());

  const handleCreate = async () => {
    const res = await fetch("/api/admin/accounting/coa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        type: form.type,
        subtype: form.subtype || undefined,
        parentId: form.parentId || null,
      }),
    });
    if (res.ok) {
      toast.success("Akun berhasil ditambahkan");
      setShowModal(false);
      setForm({ code: "", name: "", type: "ASSET", subtype: "", parentId: "" });
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal menambah akun");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus akun ini?")) return;
    const res = await fetch(`/api/admin/accounting/coa/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Akun dihapus");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal menghapus");
    }
  };

  const openEdit = (item: Coa) => {
    setEditItem(item);
    setEditForm({
      name: item.name,
      subtype: item.subtype || "",
      isActive: item.isActive,
    });
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const res = await fetch(`/api/admin/accounting/coa/${editItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        subtype: editForm.subtype || null,
        isActive: editForm.isActive,
      }),
    });
    if (res.ok) {
      toast.success("Akun berhasil diperbarui");
      setEditItem(null);
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal memperbarui akun");
    }
  };

  const countByType = (type: string) =>
    items.filter((i) => i.type === type).length;
  const parentOptions = items.filter(
    (i) => !i.parentId || items.some((c) => c.parentId === i.id),
  );

  const generateNextCode = (parentId: string): string => {
    const parent = items.find((i) => i.id === parentId);
    if (!parent) return "";
    const prefix = parent.code.split("-")[0];
    const children = items.filter((i) => i.parentId === parentId);
    if (children.length === 0) {
      const parentNum = Number(parent.code.split("-")[1]);
      return `${prefix}-${String(parentNum + 10).padStart(3, "0")}`;
    }
    const codes = children
      .map((c) => Number(c.code.split("-")[1]))
      .sort((a, b) => a - b);
    let nextNum = codes[codes.length - 1] + 10;
    const existingCodes = new Set(items.map((i) => i.code));
    while (existingCodes.has(`${prefix}-${String(nextNum).padStart(3, "0")}`)) {
      nextNum += 10;
    }
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  };

  const handleParentChange = (parentId: string) => {
    const parent = items.find((i) => i.id === parentId);
    const nextCode = parentId ? generateNextCode(parentId) : "";
    setForm({
      ...form,
      parentId,
      code: nextCode,
      type: parent?.type || form.type,
    });
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shrink-0">
            <HiOutlineRectangleStack className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Daftar Akun (COA)
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kelola daftar akun pencatatan keuangan secara berjenjang
            </p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 flex items-center gap-2 shrink-0"
          >
            <HiPlus className="h-4 w-4" />
            Tambah Akun
          </button>
        )}
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        <p className="text-sm font-semibold text-indigo-200 mb-1">
          Total Akun Terdaftar
        </p>
        <p className="text-4xl font-black">{items.length}</p>
        <p className="text-indigo-200 text-sm mt-1">akun dalam sistem</p>
      </div>

      {/* Mini Stat Cards per Type */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const).map(
          (type) => (
            <div
              key={type}
              className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
            >
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                {TYPE_LABELS[type]}
              </p>
              <p
                className={`text-xl font-black font-mono ${TYPE_ACCENT[type]}`}
              >
                {countByType(type)}
              </p>
            </div>
          ),
        )}
      </div>

      {/* Filter + Expand/Collapse */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Cari
          </label>
          <input
            type="text"
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white w-48"
            placeholder="Kode atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Tipe
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Semua Tipe</option>
            <option value="ASSET">Aset</option>
            <option value="LIABILITY">Kewajiban</option>
            <option value="EQUITY">Ekuitas</option>
            <option value="REVENUE">Pendapatan</option>
            <option value="EXPENSE">Beban</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Klasifikasi
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
            value={filterSubtype}
            onChange={(e) => setFilterSubtype(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="FIXED_ASSET">CAPEX</option>
            <option value="OPEX">OPEX</option>
            <option value="COGS">COGS</option>
            <option value="CURRENT_ASSET">Aset Lancar</option>
            <option value="CURRENT_LIABILITY">Kewajiban Lancar</option>
            <option value="LONG_TERM_LIABILITY">Kewajiban Jk. Panjang</option>
            <option value="CONTRIBUTED_CAPITAL">Modal Disetor</option>
            <option value="RETAINED_EARNINGS">Laba Ditahan</option>
            <option value="OPERATING_REVENUE">Pendapatan Operasional</option>
            <option value="OTHER_REVENUE">Pendapatan Lainnya</option>
            <option value="OTHER_EXPENSE">Beban Lainnya</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Status
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          >
            Buka Semua
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Tree Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Kode & Nama Akun
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tipe
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Klasifikasi
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Saldo
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : flatList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Belum ada akun yang terdaftar.
                </td>
              </tr>
            ) : (
              flatList.map((node) => {
                const hasChildren = node.children.length > 0;
                const isExpanded = expanded.has(node.id);
                return (
                  <tr
                    key={node.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center"
                        style={{ paddingLeft: `${node.level * 24}px` }}
                      >
                        {hasChildren ? (
                          <button
                            onClick={() => toggleExpand(node.id)}
                            className="p-0.5 mr-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {isExpanded ? (
                              <HiChevronDown className="w-4 h-4" />
                            ) : (
                              <HiChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 mr-2" />
                        )}
                        <div>
                          <span className="font-mono font-bold text-gray-500 dark:text-gray-400 text-xs mr-2">
                            {node.code}
                          </span>
                          <span
                            className={`font-medium ${node.level === 0 ? "text-gray-900 dark:text-white font-bold" : "text-gray-700 dark:text-gray-300"}`}
                          >
                            {node.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[node.type] || ""}`}
                      >
                        {TYPE_LABELS[node.type] ?? node.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {renderSubtypeBadge(node.subtype) || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono font-bold text-sm ${(node.balance ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
                      >
                        {node.balance !== undefined
                          ? formatCurrency(Math.abs(node.balance))
                          : "—"}
                      </span>
                      {node.balance !== undefined && node.balance < 0 && (
                        <span className="text-[10px] text-red-500 ml-1">
                          (Kr)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {node.isSystem && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Sistem
                          </span>
                        )}
                        {!node.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Nonaktif
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canEdit && !node.isSystem && (
                          <button
                            className="text-indigo-500 hover:text-indigo-700 p-1 transition-colors"
                            onClick={() => openEdit(node)}
                            title="Edit"
                          >
                            <HiOutlinePencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && !node.isSystem && (
                          <button
                            className="text-red-500 hover:text-red-700 p-1 transition-colors"
                            onClick={() => handleDelete(node.id)}
                            title="Hapus"
                          >
                            <HiOutlineTrash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <Modal isOpen onClose={() => setShowModal(false)} title="Tambah Akun">
          <ModalBody>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Kode Akun
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="Misal: 1-150"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Nama Akun
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="Nama akun"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Tipe
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value, subtype: "" })
                  }
                >
                  <option value="ASSET">Aset</option>
                  <option value="LIABILITY">Kewajiban</option>
                  <option value="EQUITY">Ekuitas</option>
                  <option value="REVENUE">Pendapatan</option>
                  <option value="EXPENSE">Beban</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Klasifikasi
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={form.subtype}
                  onChange={(e) =>
                    setForm({ ...form, subtype: e.target.value })
                  }
                >
                  <option value="">— Opsional —</option>
                  {form.type === "ASSET" && (
                    <>
                      <option value="CURRENT_ASSET">Aset Lancar</option>
                      <option value="FIXED_ASSET">Aset Tetap (CAPEX)</option>
                    </>
                  )}
                  {form.type === "LIABILITY" && (
                    <>
                      <option value="CURRENT_LIABILITY">
                        Kewajiban Lancar
                      </option>
                      <option value="LONG_TERM_LIABILITY">
                        Kewajiban Jangka Panjang
                      </option>
                    </>
                  )}
                  {form.type === "EQUITY" && (
                    <>
                      <option value="CONTRIBUTED_CAPITAL">Modal Disetor</option>
                      <option value="RETAINED_EARNINGS">Laba Ditahan</option>
                    </>
                  )}
                  {form.type === "REVENUE" && (
                    <>
                      <option value="OPERATING_REVENUE">
                        Pendapatan Operasional
                      </option>
                      <option value="OTHER_REVENUE">Pendapatan Lainnya</option>
                    </>
                  )}
                  {form.type === "EXPENSE" && (
                    <>
                      <option value="OPEX">Beban Operasional (OPEX)</option>
                      <option value="COGS">Harga Pokok (COGS)</option>
                      <option value="OTHER_EXPENSE">Beban Lainnya</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Akun Induk
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={form.parentId}
                  onChange={(e) => handleParentChange(e.target.value)}
                >
                  <option value="">— Tanpa Induk (Root) —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreate}
                disabled={!form.code || !form.name}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Modal
          isOpen
          onClose={() => setEditItem(null)}
          title={`Edit Akun: ${editItem.code}`}
        >
          <ModalBody>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Nama Akun
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Klasifikasi
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={editForm.subtype}
                  onChange={(e) =>
                    setEditForm({ ...editForm, subtype: e.target.value })
                  }
                >
                  <option value="">— Tidak ada —</option>
                  {editItem.type === "ASSET" && (
                    <>
                      <option value="CURRENT_ASSET">Aset Lancar</option>
                      <option value="FIXED_ASSET">Aset Tetap (CAPEX)</option>
                    </>
                  )}
                  {editItem.type === "LIABILITY" && (
                    <>
                      <option value="CURRENT_LIABILITY">
                        Kewajiban Lancar
                      </option>
                      <option value="LONG_TERM_LIABILITY">
                        Kewajiban Jangka Panjang
                      </option>
                    </>
                  )}
                  {editItem.type === "EQUITY" && (
                    <>
                      <option value="CONTRIBUTED_CAPITAL">Modal Disetor</option>
                      <option value="RETAINED_EARNINGS">Laba Ditahan</option>
                    </>
                  )}
                  {editItem.type === "REVENUE" && (
                    <>
                      <option value="OPERATING_REVENUE">
                        Pendapatan Operasional
                      </option>
                      <option value="OTHER_REVENUE">Pendapatan Lainnya</option>
                    </>
                  )}
                  {editItem.type === "EXPENSE" && (
                    <>
                      <option value="OPEX">Beban Operasional (OPEX)</option>
                      <option value="COGS">Harga Pokok (COGS)</option>
                      <option value="OTHER_EXPENSE">Beban Lainnya</option>
                    </>
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={editForm.isActive}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.checked })
                  }
                />
                <label
                  htmlFor="edit-isActive"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Aktif
                </label>
              </div>
              <button
                onClick={handleUpdate}
                disabled={!editForm.name}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan Perubahan
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
