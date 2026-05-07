import { HiCube } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { WorkOrderDetail } from "../types";

interface WoMaterialsTabProps {
  materials: WorkOrderDetail["materials"];
  isReadOnly: boolean;
  canUpdate: boolean;
  onAddMaterial: () => void;
}

export function WoMaterialsTab({
  materials,
  isReadOnly,
  canUpdate,
  onAddMaterial,
}: WoMaterialsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Material & Sparepart
        </h3>
        {!isReadOnly && canUpdate && (
          <Button onClick={onAddMaterial} variant="default" size="sm">
            <HiCube className="w-4 h-4" />
            Tambah Material
          </Button>
        )}
      </div>

      {materials && materials.length > 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {materials.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.barang.nama}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {item.barang.kode}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.quantity} {item.barang.satuan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.notes || "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <HiCube className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Belum ada material
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gunakan tombol &quot;Tambah Material&quot; untuk mencatat penggunaan
            barang.
          </p>
        </div>
      )}
    </div>
  );
}
