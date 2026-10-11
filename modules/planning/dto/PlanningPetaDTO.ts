/** Titik (ODP/ODC) rencana pada peta sebuah Planning OSP. */
export interface TitikRencanaDTO {
  nodeId: string;
  planningId: string | null;
  type: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  splitter: string | null;
  notes: string | null;
  /** `false` berarti titik sudah terbit menjadi node jaringan nyata. */
  isPlanned: boolean;
}

/** Jalur kabel rencana antara dua titik. */
export interface JalurRencanaDTO {
  edgeId: string;
  planningId: string | null;
  source: string;
  target: string;
  fiberType: string | null;
  /** Koordinat [latitude, longitude] sepanjang jalur. */
  waypoints: Array<[number, number]>;
  distance: number | null;
  notes: string | null;
  /** `false` berarti jalur sudah terbit menjadi kabel jaringan nyata. */
  isPlanned: boolean;
}

/** Seluruh isi peta sebuah planning. */
export interface PetaPlanningDTO {
  titik: TitikRencanaDTO[];
  jalur: JalurRencanaDTO[];
  /**
   * Node jaringan yang sudah nyata (bukan rencana), dipakai sebagai latar
   * redup di peta perencanaan. Hanya terisi bila pemanggil memintanya; kosong
   * berarti tidak diminta, bukan berarti jaringannya tidak ada.
   */
  nodeNyata: TitikRencanaDTO[];
  /**
   * `true` bila latar jaringan nyata diminta tetapi tidak boleh dibaca oleh
   * pemanggil. Tanpa penanda ini `nodeNyata` kosong punya dua arti yang
   * berbeda — tidak diminta, atau tidak diizinkan — dan perencana akan
   * menyimpulkan tidak ada jaringan di sana. Degradasi senyap itu yang
   * membuat rencana digambar di atas jaringan yang sudah berdiri.
   */
  latarDisembunyikanKarenaIzin: boolean;
}
