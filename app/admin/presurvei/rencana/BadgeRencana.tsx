import type { RencanaDto, TampilanStatus } from "@/modules/presurvei/client";

import {
  catatanStatusRencana,
  RENCANA_STATUS_TAMPIL_CONFIG,
  RENCANA_SUMBER_CONFIG,
  teksPembuatRencana,
} from "./tampilanRencana";

/** Badge enum berwarna. */
export function Badge({ tampilan }: { tampilan: TampilanStatus }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ${tampilan.warna}`}
    >
      {tampilan.label}
    </span>
  );
}

/** Badge status tampil beserta catatan "terlambat" bila ada. */
export function BadgeStatusRencana({
  rencana,
}: {
  rencana: Pick<RencanaDto, "statusTampil" | "isTerlambat">;
}) {
  const catatan = catatanStatusRencana(rencana);
  return (
    <div>
      <Badge tampilan={RENCANA_STATUS_TAMPIL_CONFIG[rencana.statusTampil]} />
      {catatan !== null && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          {catatan}
        </div>
      )}
    </div>
  );
}

/** Badge sumber (Mandiri/Penugasan) beserta nama pemberi tugas. */
export function BadgeSumberRencana({
  rencana,
}: {
  rencana: Pick<RencanaDto, "sumber" | "namaPembuat">;
}) {
  const pembuat = teksPembuatRencana(rencana);
  return (
    <div>
      <Badge tampilan={RENCANA_SUMBER_CONFIG[rencana.sumber]} />
      {pembuat !== null && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {pembuat}
        </div>
      )}
    </div>
  );
}
