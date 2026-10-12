"use client";

import { useGoogleMaps } from "@/contexts/GoogleMapsContext";

export type MesinPeta = "google" | "leaflet";

/**
 * Mesin peta yang dipakai layar ini.
 *
 * Satu-satunya tempat yang memutuskannya, supaya kanvas dan penandanya tidak
 * pernah berbeda pendapat: penanda Google harus berada di dalam `Map` milik
 * vis.gl, penanda Leaflet di dalam `MapContainer`, dan penanda yang salah
 * tempat tidak tampil sama sekali tanpa galat apa pun.
 *
 * `"leaflet"` selama setelan masih diambil, bukan keadaan ketiga: peta Leaflet
 * memakai petak Google yang sama dan sudah bisa dipakai, jadi berkedip dari
 * kerangka pemuatan ke peta lebih mengganggu daripada langsung menampilkannya.
 */
export function useMesinPeta(): MesinPeta {
  const { siap } = useGoogleMaps();
  return siap ? "google" : "leaflet";
}
