"use client";

import Link from "next/link";
import { LABEL_PERSONA_KARYAWAN } from "@/modules/roles/client";

import { tautanUbahRole, type PersonaRoleTerpilih } from "../lib/personaRole";

/**
 * Keterangan di bawah pilihan role: tampilan aplikasi HP mengikuti persona
 * role, dan status sales ikut persona itu — diubah di Hak Akses, bukan di sini.
 */
export function RolePersonaHint({
  personaRole,
}: {
  personaRole: PersonaRoleTerpilih | null;
}) {
  if (!personaRole) return null;

  return (
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Tampilan di HP:{" "}
      <span className="font-medium text-gray-700 dark:text-gray-200">
        {LABEL_PERSONA_KARYAWAN[personaRole.persona]}
      </span>{" "}
      (mengikuti role {personaRole.namaRole}){" · "}
      <Link
        href={tautanUbahRole(personaRole.roleId)}
        className="text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Ubah di Hak Akses
      </Link>
    </p>
  );
}
