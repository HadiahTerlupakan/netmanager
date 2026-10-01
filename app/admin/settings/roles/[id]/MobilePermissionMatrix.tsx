import { useState } from "react";
import { toast } from "react-hot-toast";
import { FiAlertTriangle, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  CATATAN_RESOURCE_MOBILE_PER_PERSONA,
  LABEL_PERSONA_KARYAWAN,
  terapkanIzinStandarMobile,
  type PersonaKaryawan,
} from "@/modules/roles/client";
import {
  getKunciKelompokMobile,
  getPeringatanMatriksMobile,
  pilahKelompokMobile,
  type KelompokIzinMobile,
} from "./mobile-permission-matrix-state";
import { PermissionGroupCard } from "./PermissionGroupCard";

interface MobilePermissionMatrixProps {
  persona: PersonaKaryawan;
  permissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  expandedGroups: string[];
  onToggleGroup: (groupKey: string) => void;
  onExpandGroups: (groupKeys: string[]) => void;
}

/**
 * Matriks izin Mobile App yang mengikuti persona: izin yang dipakai tampilan
 * persona di atas, sisanya terlipat; peringatan izin inti yang hilang dan
 * izin yang tidak akan terlihat; tombol isi izin standar persona.
 */
export function MobilePermissionMatrix({
  persona,
  permissions,
  onPermissionsChange,
  expandedGroups,
  onToggleGroup,
  onExpandGroups,
}: MobilePermissionMatrixProps) {
  const [isBagianLainTerbuka, setIsBagianLainTerbuka] = useState(false);
  const [isKonfirmasiStandarTerbuka, setIsKonfirmasiStandarTerbuka] =
    useState(false);

  const labelPersona = LABEL_PERSONA_KARYAWAN[persona];
  const { relevan, tidakRelevan } = pilahKelompokMobile(persona);
  const { izinTakTerlihat, peringatanIntiHilang } = getPeringatanMatriksMobile(
    persona,
    permissions,
  );
  const catatanResource = Object.values(
    CATATAN_RESOURCE_MOBILE_PER_PERSONA[persona],
  );

  const terapkanStandar = () => {
    setIsKonfirmasiStandarTerbuka(false);
    onPermissionsChange(terapkanIzinStandarMobile(persona, permissions));
    onExpandGroups(
      relevan.map(({ groupName }) => getKunciKelompokMobile(groupName, true)),
    );
    toast.success(`Izin standar ${labelPersona} diterapkan`);
  };

  const renderKelompok = (
    { groupName, resources }: KelompokIzinMobile,
    isRelevan: boolean,
  ) => {
    const groupKey = getKunciKelompokMobile(groupName, isRelevan);
    return (
      <PermissionGroupCard
        key={groupKey}
        groupName={groupName}
        resources={resources}
        permissions={permissions}
        onPermissionsChange={onPermissionsChange}
        isExpanded={expandedGroups.includes(groupKey)}
        onToggleExpand={() => onToggleGroup(groupKey)}
        onGroupSelectAll={() => onExpandGroups([groupKey])}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Dipakai di tampilan {labelPersona}
        </p>
        <button
          type="button"
          onClick={() => setIsKonfirmasiStandarTerbuka(true)}
          className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 transition-colors"
        >
          Isi izin standar {labelPersona}
        </button>
      </div>

      {peringatanIntiHilang.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
        >
          {peringatanIntiHilang.map((peringatan) => (
            <li key={peringatan} className="flex items-start gap-2">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {peringatan}
            </li>
          ))}
        </ul>
      )}

      {catatanResource.map((catatan) => (
        <p key={catatan} className="text-xs text-gray-500 dark:text-gray-400">
          {catatan}
        </p>
      ))}

      {relevan.map((kelompok) => renderKelompok(kelompok, true))}

      {tidakRelevan.length > 0 && (
        <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
          <button
            type="button"
            onClick={() => setIsBagianLainTerbuka((terbuka) => !terbuka)}
            aria-expanded={isBagianLainTerbuka}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <span>
              <span className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Tidak tampil di HP {labelPersona}
              </span>
              {izinTakTerlihat.length > 0 && (
                <span className="block text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {izinTakTerlihat.length} izin tidak akan terlihat di HP
                </span>
              )}
            </span>
            {isBagianLainTerbuka ? (
              <FiChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {isBagianLainTerbuka && (
            <div className="px-4 pb-4 space-y-4">
              {tidakRelevan.map((kelompok) => renderKelompok(kelompok, false))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isKonfirmasiStandarTerbuka}
        title={`Isi izin standar ${labelPersona}?`}
        description={`Semua centang izin Mobile App akan diganti dengan izin standar tampilan ${labelPersona}. Izin Portal Admin tidak berubah.`}
        confirmText="Ganti izin mobile"
        cancelText="Batal"
        onConfirm={terapkanStandar}
        onCancel={() => setIsKonfirmasiStandarTerbuka(false)}
      />
    </div>
  );
}
