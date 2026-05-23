/**
 * Domain errors untuk modul accel-ppp.
 * Setiap error mewakili kondisi domain yang nantinya dipetakan
 * ke HTTP status code di lapisan API route.
 */

/** Setting global Full RADIUS Mode dimatikan → operasi accel-ppp ditolak. → 403 */
export class FullRadiusModeDisabledError extends Error {
  constructor(message = "Full RADIUS Mode tidak aktif") {
    super(message);
    this.name = "FullRadiusModeDisabledError";
  }
}

/** Server accel-ppp tidak ditemukan dalam scope tenant. → 404 */
export class AccelPppServerNotFoundError extends Error {
  constructor(message = "Accel-PPP server tidak ditemukan") {
    super(message);
    this.name = "AccelPppServerNotFoundError";
  }
}

/** IP address sudah terdaftar untuk tenant ini. → 409 */
export class AccelPppDuplicateIpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccelPppDuplicateIpError";
  }
}

/** Tidak bisa membuka koneksi TCP ke CLI socket accel-ppp. → 503 */
export class AccelPppCliConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccelPppCliConnectionError";
  }
}

/** Perintah CLI ditolak / response invalid (mis. auth gagal, syntax salah). → 503 */
export class AccelPppCliCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccelPppCliCommandError";
  }
}

/** Operasi CLI melewati batas waktu. → 504 */
export class AccelPppCliTimeoutError extends Error {
  constructor(message = "Accel-PPP CLI timeout") {
    super(message);
    this.name = "AccelPppCliTimeoutError";
  }
}

/** Sinkronisasi NAS row di FreeRADIUS DB gagal. → 503 */
export class AccelPppRadiusNasSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccelPppRadiusNasSyncError";
  }
}

/** Username yang akan di-kick tidak sedang aktif di server. → 404 */
export class AccelPppSessionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccelPppSessionNotFoundError";
  }
}
