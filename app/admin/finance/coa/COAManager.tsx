'use client';

import { useState, useMemo } from 'react';
import type { ChartOfAccount } from '@/types/finance';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineFolder,
  HiOutlineFolderOpen,
  HiOutlineDocumentText,
} from 'react-icons/hi2';
import { toast } from 'react-hot-toast';

interface COAManagerProps {
  initialData: ChartOfAccount[];
}

interface COAFormData {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subType: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  parentId: string | null;
  description: string;
  isHeader: boolean;
  allowPosting: boolean;
}

interface COAWithChildren extends ChartOfAccount {
  children?: COAWithChildren[];
}

const TABS = [
  { id: 'ASSET', label: 'Aset', color: 'blue', icon: '💰' },
  { id: 'LIABILITY', label: 'Kewajiban', color: 'red', icon: '📉' },
  { id: 'EQUITY', label: 'Modal', color: 'purple', icon: '🏛️' },
  { id: 'REVENUE', label: 'Pendapatan', color: 'green', icon: '📈' },
  { id: 'EXPENSE', label: 'Beban', color: 'orange', icon: '💸' },
];

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Aset', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'LIABILITY', label: 'Kewajiban', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'EQUITY', label: 'Modal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'REVENUE', label: 'Pendapatan', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'EXPENSE', label: 'Beban', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
];

const TAB_THEMES: Record<string, string> = {
  ASSET: 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  LIABILITY: 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  EQUITY: 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  REVENUE: 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  EXPENSE: 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
};

const SUB_TYPES: Record<string, { value: string; label: string }[]> = {
  ASSET: [
    { value: 'CURRENT_ASSET', label: 'Aset Lancar' },
    { value: 'FIXED_ASSET', label: 'Aset Tetap' },
  ],
  LIABILITY: [
    { value: 'CURRENT_LIABILITY', label: 'Hutang Jangka Pendek' },
    { value: 'LONG_TERM_LIABILITY', label: 'Hutang Jangka Panjang' },
  ],
  EQUITY: [
    { value: 'EQUITY', label: 'Modal' },
  ],
  REVENUE: [
    { value: 'OPERATING_REVENUE', label: 'Pendapatan Operasional' },
    { value: 'OTHER_REVENUE', label: 'Pendapatan Lainnya' },
  ],
  EXPENSE: [
    { value: 'COGS', label: 'HPP' },
    { value: 'OPEX', label: 'Biaya Operasional' },
    { value: 'CAPEX_TRACKING', label: 'CAPEX' },
    { value: 'TAX', label: 'Pajak' },
  ],
};

export default function COAManager({ initialData }: COAManagerProps) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>(initialData);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<COAFormData>({
    code: '',
    name: '',
    type: 'ASSET',
    subType: '',
    normalBalance: 'DEBIT',
    parentId: null,
    description: '',
    isHeader: false,
    allowPosting: true,
  });

  // Build hierarchical tree structure
  const buildTree = (items: ChartOfAccount[]): COAWithChildren[] => {
    const itemMap = new Map<string, COAWithChildren>();
    const roots: COAWithChildren[] = [];

    items.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // Filter accounts based on search and active tab
  const filteredAccounts = useMemo(() => {
    let result = accounts;

    // Filter by tab
    result = result.filter(acc => acc.type === activeTab);

    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(
      acc =>
        acc.code.toLowerCase().includes(query) ||
        acc.name.toLowerCase().includes(query)
    );
  }, [accounts, searchQuery, activeTab]);

  const accountTree = useMemo(() => buildTree(filteredAccounts), [filteredAccounts]);

  const suggestNextCode = (parentId: string | null, type: string): string => {
    // Find siblings
    const siblings = accounts.filter(acc => acc.parentId === parentId && acc.type === type);

    if (siblings.length === 0) {
      if (parentId) {
        // Find parent code
        const parent = accounts.find(acc => acc.id === parentId);
        return parent ? `${parent.code}.01` : '';
      }
      // For root level, suggest based on type if possible, or just empty
      const typePrefixMap: Record<string, string> = {
        ASSET: '1',
        LIABILITY: '2',
        EQUITY: '3',
        REVENUE: '4',
        EXPENSE: '5'
      };
      const prefix = typePrefixMap[type] || '';
      return prefix ? `${prefix}000` : '';
    }

    // Sort siblings by code
    const sortedSiblings = [...siblings].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    const lastCode = sortedSiblings[sortedSiblings.length - 1].code;

    // Try to increment the last part of the code
    const parts = lastCode.split('.');
    const lastPart = parts[parts.length - 1];

    if (/^\d+$/.test(lastPart)) {
      const nextNum = parseInt(lastPart, 10) + 1;
      const paddedNextNum = nextNum.toString().padStart(lastPart.length, '0');
      parts[parts.length - 1] = paddedNextNum;
      return parts.join('.');
    }

    return lastCode; // Fallback to last code if we can't increment
  };

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const openCreateModal = (parentAccount?: ChartOfAccount) => {
    setEditingAccount(null);
    const parentId = parentAccount?.id || null;
    const type = (parentAccount?.type as any) || activeTab;
    const suggestedCode = suggestNextCode(parentId, type);

    setFormData({
      code: suggestedCode,
      name: '',
      type,
      subType: parentAccount?.subType || '',
      normalBalance: parentAccount?.normalBalance || (type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT'),
      parentId,
      description: '',
      isHeader: false,
      allowPosting: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType || '',
      normalBalance: account.normalBalance,
      parentId: account.parentId || null,
      description: account.description || '',
      isHeader: account.isHeader,
      allowPosting: account.allowPosting,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = editingAccount 
        ? `/api/finance/coa/${editingAccount.id}` 
        : '/api/finance/coa';
      const method = editingAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Gagal menyimpan akun');
      }

      const savedAccount = await response.json();

      if (editingAccount) {
        setAccounts(prev => prev.map(acc => 
          acc.id === savedAccount.id ? savedAccount : acc
        ));
        toast.success('Akun berhasil diperbarui');
      } else {
        setAccounts(prev => [...prev, savedAccount]);
        toast.success('Akun berhasil ditambahkan');
      }

      setIsModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (account: ChartOfAccount) => {
    if (!confirm(`Yakin ingin menghapus akun "${account.name}" (${account.code})?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/finance/coa/${account.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Gagal menghapus akun');
      }

      setAccounts(prev => prev.filter(acc => acc.id !== account.id));
      toast.success('Akun berhasil dihapus');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan');
    }
  };

  const getTypeLabel = (type: string) => {
    return ACCOUNT_TYPES.find(t => t.value === type) || { label: type, color: 'bg-gray-100' };
  };

  const getSubTypeLabel = (type: string, subType: string | null) => {
    if (!subType) return '-';
    const types = SUB_TYPES[type] || [];
    return types.find(t => t.value === subType)?.label || subType;
  };

  const getPaddingClass = (level: number): string => {
    const paddingMap: Record<number, string> = {
      0: '',
      1: 'pl-8',
      2: 'pl-16',
      3: 'pl-24',
      4: 'pl-32',
    };
    return paddingMap[level] || 'pl-32';
  };

  const renderAccountTree = (nodes: COAWithChildren[], level = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedCodes.has(node.code);
      const typeInfo = getTypeLabel(node.type);
      const paddingClass = getPaddingClass(level);
      const isHeader = node.isHeader || hasChildren;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center justify-between p-3 transition-colors ${
              isHeader
                ? 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/30'
            } border-b border-gray-100 dark:border-gray-800 ${paddingClass}`}
          >
            <div className="flex items-center gap-3 flex-1">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(node.code)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {isExpanded ? (
                    <HiOutlineChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <HiOutlineChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
              ) : (
                <span className="w-6" />
              )}

              {isHeader ? (
                isExpanded ? (
                  <HiOutlineFolderOpen className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                ) : (
                  <HiOutlineFolder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                )
              ) : (
                <HiOutlineDocumentText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 w-16">{node.code}</span>
                  <span className={`text-gray-900 dark:text-gray-100 ${isHeader ? 'font-bold' : 'font-normal'}`}>
                    {node.name}
                  </span>
                  {node.isHeader && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">
                      Header
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <span>•</span>
                  <span className="text-xs">{getSubTypeLabel(node.type, node.subType || null)}</span>
                  <span>•</span>
                  <span className={`text-xs ${node.normalBalance === 'DEBIT' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    {node.normalBalance === 'DEBIT' ? 'Debit' : 'Kredit'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => openCreateModal(node)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Tambah sub-akun"
              >
                <HiOutlinePlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => openEditModal(node)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Edit"
              >
                <HiOutlinePencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(node)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Hapus"
              >
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="bg-gray-50/30 dark:bg-gray-800/10">
              {renderAccountTree(node.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chart of Accounts (COA)</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola daftar akun perkiraan untuk pencatatan keuangan
          </p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tambah Akun
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-px">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = accounts.filter(a => a.type === tab.id).length;

          const activeClasses = isActive ? TAB_THEMES[tab.id] : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${activeClasses}`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                isActive ? 'bg-white/50 dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder={`Cari kode atau nama akun ${TABS.find(t => t.id === activeTab)?.label}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      {/* Account Tree */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span className="flex-1">Detail Akun</span>
            <span className="w-32 text-center">Aksi</span>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {accountTree.length > 0 ? (
            renderAccountTree(accountTree)
          ) : (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'Tidak ada akun yang cocok dengan pencarian' : `Belum ada akun untuk kategori ${TABS.find(t => t.id === activeTab)?.label}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <HiOutlinePlus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <input
                      type="checkbox"
                      id="isHeader"
                      checked={formData.isHeader}
                      onChange={(e) => {
                        const isHeader = e.target.checked;
                        setFormData({
                          ...formData,
                          isHeader,
                          allowPosting: isHeader ? false : formData.allowPosting
                        });
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="isHeader" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      Akun Header
                    </label>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    formData.isHeader
                      ? 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10 opacity-50'
                      : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'
                  }`}>
                    <input
                      type="checkbox"
                      id="allowPosting"
                      disabled={formData.isHeader}
                      checked={formData.allowPosting}
                      onChange={(e) => setFormData({ ...formData, allowPosting: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <label htmlFor="allowPosting" className={`text-sm font-medium cursor-pointer ${
                      formData.isHeader ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      Dapat Diposting
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kode Akun *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Contoh: 1101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Akun *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Contoh: Kas di Tangan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipe Akun *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value as COAFormData['type'];
                        const suggestedCode = !editingAccount ? suggestNextCode(formData.parentId, newType) : formData.code;

                        setFormData({
                          ...formData,
                          type: newType,
                          code: suggestedCode,
                          subType: '',
                          normalBalance: newType === 'ASSET' || newType === 'EXPENSE' ? 'DEBIT' : 'CREDIT'
                        });
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      {ACCOUNT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sub Tipe
                    </label>
                    <select
                      value={formData.subType}
                      onChange={(e) => setFormData({ ...formData, subType: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">- Pilih -</option>
                      {(SUB_TYPES[formData.type] || []).map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Normal Balance *
                  </label>
                  <select
                    required
                    value={formData.normalBalance}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as 'DEBIT' | 'CREDIT' })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Kredit</option>
                  </select>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 italic">
                    {formData.type === 'ASSET' || formData.type === 'EXPENSE'
                      ? 'Normalnya bertambah di sisi Debit'
                      : 'Normalnya bertambah di sisi Kredit'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Akun Induk
                  </label>
                  <select
                    value={formData.parentId || ''}
                    onChange={(e) => {
                      const newParentId = e.target.value || null;
                      const parent = accounts.find(a => a.id === newParentId);
                      const suggestedCode = !editingAccount ? suggestNextCode(newParentId, formData.type) : formData.code;

                      setFormData({
                        ...formData,
                        parentId: newParentId,
                        code: suggestedCode,
                        subType: parent?.subType || formData.subType,
                        normalBalance: parent?.normalBalance || formData.normalBalance
                      });
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">- Tidak ada (Akun Utama) -</option>
                    {accounts
                      .filter(a => a.type === formData.type && a.id !== editingAccount?.id)
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Deskripsi opsional..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md active:scale-95 transition-all"
                  >
                    {isLoading ? 'Menyimpan...' : editingAccount ? 'Simpan Perubahan' : 'Tambah Akun'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
