"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { clientLogger } from "@/lib/client-logger";

interface DepartmentFormData {
  name: string;
  description: string;
  jobDescription: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  jobDescription: string | null;
  _count?: {
    employees: number;
  };
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  onSave: (data: DepartmentFormData) => Promise<void>;
}

export default function DepartmentModal({
  isOpen,
  onClose,
  department,
  onSave,
}: DepartmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    jobDescription: "",
  });

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name,
        description: department.description || "",
        jobDescription: department.jobDescription || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        jobDescription: "",
      });
    }
  }, [department, isOpen]);

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      clientLogger.error("Error saving department:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={department ? `Edit: ${department.name}` : "Department Baru"}
      description={
        department
          ? "Update informasi department"
          : "Tambah department baru ke organisasi"
      }
      size="2xl"
    >
      <div className="p-6">
        <form onSubmit={handleSaveDepartment} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nama Department <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="IT Department, Human Resources, dll."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              placeholder="Deskripsi singkat tentang department..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Job Description
            </label>
            <textarea
              value={formData.jobDescription}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  jobDescription: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              placeholder="Detail tugas dan tanggung jawab..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
