/** Router yang masih memakai sebuah server VPN, untuk pesan penolakan. */
export interface VpnServerRouterUsage {
  id: string;
  name: string;
  tenantName: string;
}

/** Server VPN tidak boleh dihapus/dicabut karena masih dipakai router. */
export class VpnServerInUseError extends Error {
  constructor(public readonly routers: VpnServerRouterUsage[]) {
    super("Server VPN masih dipakai router");
    this.name = "VpnServerInUseError";
  }
}

/** Id server VPN yang diminta tidak ada di database lokal. */
export class VpnServerUnknownError extends Error {
  constructor() {
    super("Server VPN tidak ditemukan");
    this.name = "VpnServerUnknownError";
  }
}

/** Draft router VPN milik tenant lain. */
export class VpnDraftForbiddenError extends Error {
  constructor() {
    super("Draft VPN bukan milik tenant ini");
    this.name = "VpnDraftForbiddenError";
  }
}

/** Server VPN yang diminta tidak di-assign ke tenant atau sedang tidak online. */
export class VpnServerNotAvailableError extends Error {
  constructor() {
    super("Server VPN tidak tersedia untuk tenant ini");
    this.name = "VpnServerNotAvailableError";
  }
}

/** Draft router VPN tidak bisa dipakai untuk router ini; pesan ditampilkan ke pengguna. */
export class VpnDraftInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnDraftInvalidError";
  }
}

/** Router sudah tersimpan tetapi core menolak/gagal meng-claim draft-nya. */
export class VpnRouterActivationError extends Error {
  constructor() {
    super("Gagal mengaktifkan VPN router");
    this.name = "VpnRouterActivationError";
  }
}

/** Permintaan VPN untuk router tersimpan ditolak; pesan ditampilkan ke pengguna. */
export class VpnRouterInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnRouterInvalidError";
  }
}

/** Router VPN tidak bisa dihubungi lewat API RouterOS. */
export class VpnRouterUnreachableError extends Error {
  constructor() {
    super("Router tidak dapat dihubungi");
    this.name = "VpnRouterUnreachableError";
  }
}

/** Satu langkah pindah PUBLIC ⇄ VPN gagal; langkah sebelumnya sudah dibatalkan. */
export class VpnRouterMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpnRouterMigrationError";
  }
}
