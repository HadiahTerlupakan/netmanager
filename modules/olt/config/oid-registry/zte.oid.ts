/**
 * ZTE GPON OLT OID Registry & ifIndex Encoding
 *
 * VERIFIED ON: ZTE C300 production device (firmware ~V2.x), Mei 2026.
 * Branch: zxAN-PON-MIB enterprise (1.3.6.1.4.1.3902.1082)
 *
 * COMPATIBILITY:
 * - ZTE C300                → diverifikasi via snmpwalk lapangan ✅
 * - ZTE C320                → diasumsikan kompatibel (sama MIB tree, sama CLI dialect)
 * - ZTE C600 / C650 (XGSPON) → BELUM diuji, OID upstream berbeda
 * - ZTE C220 (legacy)        → branch 1.3.6.1.4.1.3902.1015 (TIDAK kompatibel)
 *
 * ────────────────────────────────────────────────────────────────────────
 *  ZTE ifIndex Encoding
 * ────────────────────────────────────────────────────────────────────────
 *
 * Yang sebelumnya saya kira OID format `<frame>.<slot>.<port>.<onuIndex>`
 * (4 segments), ternyata ZTE pakai SINGLE ifIndex ter-encode + onuIndex
 * (2 segments).
 *
 * ifIndex = (frame << 28) | (0xFF << 16) | (slot << 8) | port
 *
 *   frame 1, slot 7, port 8  → 0x10FF0708 = 285280008
 *   frame 1, slot 8, port 1  → 0x10FF0801 = 285280257
 *   frame 1, slot 9, port 4  → 0x10FF0904 = 285280516
 *
 * Untuk OLT multi-frame chassis (rack besar), frame > 1 akan menggeser
 * upper nibble (0x20FF... untuk frame 2, 0x30FF... untuk frame 3).
 * Konstanta 0xFF di bits 16-23 = card type "GPON OLT line card".
 *
 * ────────────────────────────────────────────────────────────────────────
 *  OID Branch Reference
 * ────────────────────────────────────────────────────────────────────────
 *
 * - .500.10.2.2.5.1     = unregistered ONU table (auto-find)
 * - .500.10.2.3.3.1     = registered ONU table (entries)
 *   - .1                = ifIndex (column 1, redundant dengan OID suffix)
 *   - .2                = ONU name / description (string ber-isi label
 *                         yang diset operator, mis. "261505179323-Suci Susanti")
 *   - .3                = ONU serial number (hex string atau ASCII)
 *   - .X                = phase state (online/offline/los) — KOLOM PERLU
 *                         DIVERIFIKASI dengan snmpwalk per device
 * - .500.10.X           = optical power tables — JUGA PERLU verifikasi
 *
 * Sebelum deploy ke firmware/model baru:
 * 1. snmpwalk -v2c -c <community> <ip> 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1
 *    → identifikasi semua kolom di registered ONU table
 * 2. Untuk tiap kolom yang nilainya integer, snmpget atomik untuk SN
 *    yang status-nya kamu tahu (online/offline) → mapping kolom ke status
 * 3. Update kolom OID di registry ini berdasarkan hasil verifikasi
 *
 * Sumber:
 * - ZXAN-PON-MIB.txt (ZTE official MIB file, jika tersedia)
 * - Output snmpwalk lapangan: 113.192.1.42 (BRAS-CARIU-BGR), Mei 2026
 */

/**
 * ifIndex encoding ZTE C300/C320 untuk GPON OLT line card.
 *
 * Verified empirically dari `show gpon onu state` + SNMP walk:
 *   ifIndex 285280008 = hex 0x11010708 → frame=1, slot=7, port=8
 *   ifIndex 285280257 = hex 0x11010801 → frame=1, slot=8, port=1
 *   ifIndex 285280513 = hex 0x11010901 → frame=1, slot=9, port=1
 *
 * Layout:
 *   bits 28-31 (nibble F): frame
 *   bits 16-27 (12 bits) : interface type marker (0x101 untuk GPON OLT)
 *   bits 8-15  (1 byte)  : slot
 *   bits 0-7   (1 byte)  : port
 *
 * Marker 0x101 dipakai untuk GPON OLT interface. ifIndex untuk
 * card type lain (uplink Ethernet, dll) pakai marker berbeda.
 */
const GPON_OLT_IF_TYPE_MARKER = 0x101;
const SLOT_MASK = 0xff;
const PORT_MASK = 0xff;
const IF_TYPE_MASK = 0xfff;

function encodeOltIfIndex(frame: number, slot: number, port: number): number {
  return (
    ((frame & 0xf) << 28) |
    (GPON_OLT_IF_TYPE_MARKER << 16) |
    ((slot & SLOT_MASK) << 8) |
    (port & PORT_MASK)
  );
}

/**
 * Decode ifIndex ZTE menjadi (frame, slot, port).
 * Return null jika marker bukan GPON OLT (artinya ifIndex dari
 * card type lain seperti Ethernet/uplink).
 */
function decodeOltIfIndex(ifIndex: number): {
  frame: number;
  slot: number;
  port: number;
} | null {
  const ifTypeMarker = (ifIndex >>> 16) & IF_TYPE_MASK;
  if (ifTypeMarker !== GPON_OLT_IF_TYPE_MARKER) return null;
  return {
    frame: (ifIndex >>> 28) & 0xf,
    slot: (ifIndex >>> 8) & SLOT_MASK,
    port: ifIndex & PORT_MASK,
  };
}

/**
 * ifIndex encoding alternatif yang dipakai branch ZXGPON-MIB
 * (.3902.1012.x). BERBEDA dari ZTE-AN-MIB (.3902.1082.x).
 *
 * Verified:
 *   ifIndex 268896256 = hex 0x10070800 → frame=1, slot=7, port=8
 *
 * Layout:
 *   bits 24-31 (1 byte): magic 0x10
 *   bits 16-23 (1 byte): slot
 *   bits 8-15  (1 byte): port
 *   bits 0-7   (1 byte): 0 (reserved)
 */
const ZXGPON_IF_TYPE_MARKER = 0x10;

function encodeZxGponIfIndex(slot: number, port: number): number {
  return (
    (ZXGPON_IF_TYPE_MARKER << 24) |
    ((slot & SLOT_MASK) << 16) |
    ((port & PORT_MASK) << 8)
  );
}

function decodeZxGponIfIndex(ifIndex: number): {
  frame: number;
  slot: number;
  port: number;
} | null {
  const marker = (ifIndex >>> 24) & 0xff;
  if (marker !== ZXGPON_IF_TYPE_MARKER) return null;
  return {
    frame: 1, // ZXGPON encoding tidak include frame, default ke 1
    slot: (ifIndex >>> 16) & SLOT_MASK,
    port: (ifIndex >>> 8) & PORT_MASK,
  };
}

export const ZteOidRegistry = {
  system: {
    sysDescr: "1.3.6.1.2.1.1.1.0",
    sysUpTime: "1.3.6.1.2.1.1.3.0",
    sysName: "1.3.6.1.2.1.1.5.0",
  },

  card: {
    // ZTE-AN-CHASSIS-MIB (zxAnCardTable) — verified ZTE C300 GPON OLT.
    // Branch: 1.3.6.1.4.1.3902.1082.10.1.2.4 (zxAnCardTable)
    //   .1.4 = zxAnCardActualType (string, model card seperti "ATUGA")
    //   .1.5 = zxAnCardOperStatus (INTEGER: 1=inService, 2=notInService, ...)
    // OID suffix di walk: <slot> (0~20 IEC, 0~22 ETSI)
    actualTypeTable: "1.3.6.1.4.1.3902.1082.10.1.2.4.1.4",
    operStatus: "1.3.6.1.4.1.3902.1082.10.1.2.4.1.5",
  },

  gpon: {
    /**
     * Generate OID untuk attribute spesifik ONU.
     * Format final: <table>.<column>.<oltIfIndex>.<onuIndex>
     *
     * COLUMN MAPPING (verified C300 V2.x lapangan):
     *  .1 = ONU type/profile (e.g. "ALL", "F660")
     *  .2 = ONU description / alias (operator-set)
     *  .3 = ONU default name (e.g. "ONU-8:1")
     *  .5 = phase state (INTEGER: 1=working, 2=offline, 3=los, ...)
     *  .6 = serial number (raw 8-byte binary, encoding bervariasi)
     *  .10 = admin state (INTEGER: 1=disabled, 2=enabled)
     *
     * RX/TX power table BELUM ditemukan di branch .500.10. Mungkin di
     * branch enterprise berbeda atau butuh walk lanjutan.
     */
    onuName: (frame: number, slot: number, port: number, onuIndex: number) => {
      const ifIndex = encodeOltIfIndex(frame, slot, port);
      return `1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.${ifIndex}.${onuIndex}`;
    },
    onuSerialNumber: (
      frame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) => {
      const ifIndex = encodeOltIfIndex(frame, slot, port);
      return `1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.6.${ifIndex}.${onuIndex}`;
    },
    /**
     * Phase state (verified column .5 di C300 lapangan, value INTEGER).
     */
    onuStatus: (
      frame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) => {
      const ifIndex = encodeOltIfIndex(frame, slot, port);
      return `1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.5.${ifIndex}.${onuIndex}`;
    },
    /**
     * UNAVAILABLE di C300 V2.x lapangan (verified Mei 2026): tidak ada
     * branch power di MIB ZTE enterprise. Adapter sekarang fallback
     * otomatis ke CLI `show pon power attenuation` saat SNMP balas
     * "No Such Object". Untuk firmware lain yang expose power via SNMP,
     * adapter akan pakai SNMP duluan.
     */
    onuRxPower: (
      frame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) => {
      const ifIndex = encodeOltIfIndex(frame, slot, port);
      return `1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.2.${ifIndex}.${onuIndex}`;
    },
    /**
     * UNAVAILABLE di C300 V2.x lapangan — lihat catatan onuRxPower.
     */
    onuTxPower: (
      frame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) => {
      const ifIndex = encodeOltIfIndex(frame, slot, port);
      return `1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.1.${ifIndex}.${onuIndex}`;
    },

    // Tables — base OID untuk SNMP walk
    /**
     * UNAVAILABLE di C300 V2.x (verified Mei 2026 di BRAS-CARIU-BGR):
     * branch ini return "No Such Object". Discovery unregistered ONU
     * di firmware ini hanya bisa via CLI `show gpon onu uncfg` (telnet).
     * Kalau firmware lain (mis. C320 baru) expose branch ini, biarkan
     * sebagai fallback untuk SNMP-based discovery.
     */
    unregisteredOnuTable: "1.3.6.1.4.1.3902.1082.500.10.2.2.5.1",
    /**
     * Verified ada di C300 lapangan: kolom .2 berisi ONU description
     * (string yang diset operator via `name <alias>` di interface mode).
     * Cocok untuk enumerasi (frame, slot, port, onuIndex) seluruh ONU
     * teregistrasi via SNMP walk → parseOnuIndex().
     */
    registeredOnuNameTable: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2",
    registeredOnuSerialTable: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.6",
    /**
     * Phase state table — verified column .5 di C300 lapangan.
     */
    onuStatusTable: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.5",
  },

  /**
   * ZXGPON-MIB (ZTE GPON-specific MIB) — branch terpisah dari ZTE-AN.
   * Branch: 1.3.6.1.4.1.3902.1012
   *
   * Berbeda dari ZTE-AN (.1082), branch ini fokus ke OAM data ONU
   * seperti phase state, optical power, distance.
   *
   * IMPORTANT: ifIndex format BERBEDA dari ZTE-AN.
   * ZTE-AN  (.1082): hex 0x11 01 SS PP (frame|0x101|slot|port)
   * ZXGPON  (.1012): hex 0x10 SS PP 00 (0x10|slot|port|0)
   * Verified di C300 V2.1.0 lapangan.
   *
   * Phase state values (verified vs `show gpon onu state`):
   *   3 = working (online)
   *   4 = dying_gasp
   *   6 = offline
   */
  zxGpon: {
    /** Phase state per ONU. Verified C300 V2.1.0. */
    onuPhaseStateTable: "1.3.6.1.4.1.3902.1012.3.28.2.1.4",
    /** ONU name (default "ONU-X:Y"). */
    onuNameTable: "1.3.6.1.4.1.3902.1012.3.28.1.1.3",
    /** ONU distance dari OLT dalam meter. Verified vs detail-info. */
    onuDistanceTable: "1.3.6.1.4.1.3902.1012.3.11.4.1.2",
    /**
     * ONU vendor info table (dari ZXGPON-ONT-MGMT-MIB).
     * Verified columns C300 V2.1.0:
     *   .1 = vendor (e.g. "ZTEG", "GGCL", "RTEG")
     *   .2 = software version (e.g. "V3.0")
     *   .9 = equipment ID / model (e.g. "F609V3.0")
     *   .17 = ONU type model (e.g. "F609V3.0")
     */
    onuVendorTable: "1.3.6.1.4.1.3902.1012.3.50.11.2.1.1",
    onuSoftwareVersionTable: "1.3.6.1.4.1.3902.1012.3.50.11.2.1.2",
    onuModelTable: "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9",
  },

  /**
   * ZXGPON-OPTICAL-MIB (ZTE proprietary, branch .3902.1015.1010).
   * Branch: 1.3.6.1.4.1.3902.1015.1010.11.2.1
   *
   * Berisi optical power data per ONU. Format index sama dengan ZXGPON
   * (1012): <ifIndex>.<onuIndex> dengan ifIndex encoding 0x10 SS PP 00.
   *
   * Verified di C300 V2.1.0 lapangan:
   *   .2 = OLT-side RX power (dBm × 1000, INTEGER)
   *        Value -29888 = -29.888 dBm (signal yang OLT terima dari ONU)
   *        Value -80000 = no signal (ONU offline/los)
   *   .3 = duplikat .2 (RX cur, sama value)
   *   .4 = RX threshold low (-30000 = -30.000 dBm)
   *   .5 = RX threshold critical (-34000 = -34.000 dBm)
   *
   * Multiplier: 0.001 untuk convert ke dBm.
   */
  zxGponOptical: {
    /** RX power dari OLT side (yang OLT terima dari ONU). dBm × 1000 */
    oltRxPowerTable: "1.3.6.1.4.1.3902.1015.1010.11.2.1.2",
    /** RX power threshold low (warning level). dBm × 1000 */
    oltRxPowerThreshLow: "1.3.6.1.4.1.3902.1015.1010.11.2.1.4",
    /** RX power threshold critical. dBm × 1000 */
    oltRxPowerThreshCritical: "1.3.6.1.4.1.3902.1015.1010.11.2.1.5",
  },

  /**
   * ZXGPON Optical Power per-ONU (ZTE C300 V2.1.0 verified).
   * Branch: 1.3.6.1.4.1.3902.1012.3.50.12.1.1
   *
   * OID format: <branch>.<column>.<oltIfIndex>.<onuIndex>.1
   *   - oltIfIndex: ZXGPON encoding 0x10 SS PP 00
   *   - onuIndex: 1, 2, 3, ...
   *   - trailing .1: sub-instance (always 1)
   *
   * Verified columns (matching `show pon power attenuation`):
   *   .10 = ONU RX power (downstream, what ONU receives from OLT)
   *         INTEGER raw value, formula: raw * 0.002 - 30 = dBm
   *         Verified: 3314 → -23.372 dBm (matches CLI output)
   *   .14 = ONU TX power (upstream, what ONU transmits to OLT)
   *         INTEGER raw value, formula: raw * 0.002 - 30 = dBm
   *         Verified: 16138 → 2.276 dBm (matches CLI output)
   *
   * Sentinel value: 65535 atau >30000 = no signal / offline.
   *
   * Source: forum local.com.ua thread + Cacti template by Maksel.
   */
  zxGponOnuPower: {
    /** ONU RX power (downstream). Raw INTEGER, decode: raw * 0.002 - 30 = dBm */
    onuRxPowerTable: "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10",
    /** ONU TX power (upstream). Raw INTEGER, decode: raw * 0.002 - 30 = dBm */
    onuTxPowerTable: "1.3.6.1.4.1.3902.1012.3.50.12.1.1.14",
  },

  /**
   * ZTE Service-Port table (MIB ZTE-AN-SERVICE-PORT-MIB).
   * Branch: 1.3.6.1.4.1.3902.1082.110.5.2.2.1
   *
   * OID format walk: <branch>.<column>.<oltIfIndex>.<servicePortIndex>
   *   - oltIfIndex: GPON OLT ifIndex (encodeOltIfIndex)
   *   - servicePortIndex: format ZTE 0x18<onuIndex>0100
   *     byte 24-31 = 0x18 (service-port marker)
   *     byte 16-23 = onuIndex
   *     byte 0-15  = 0x0100 (vport.1 sub-service)
   *
   * Verified columns (C300 V2.1.0 lapangan):
   *   .1  = zxAnSrvPortDesc       (string, e.g. "PPP213")
   *   .4  = zxAnSrvPortServiceMode (int, 1=untag, 4=tag, 5=tls/double-tag)
   *   .8  = zxAnSrvPortUserVid    (int, user-side VLAN ID 1-4094)
   *   .18 = zxAnSrvPortCVid       (int, network-side CVLAN ID 1-4094)
   *   .19 = zxAnSrvPortSVid       (int, network-side SVLAN ID, 0 if no QinQ)
   */
  servicePort: {
    descTable: "1.3.6.1.4.1.3902.1082.110.5.2.2.1.1",
    serviceModeTable: "1.3.6.1.4.1.3902.1082.110.5.2.2.1.4",
    userVidTable: "1.3.6.1.4.1.3902.1082.110.5.2.2.1.8",
    cVidTable: "1.3.6.1.4.1.3902.1082.110.5.2.2.1.18",
    sVidTable: "1.3.6.1.4.1.3902.1082.110.5.2.2.1.19",
  },

  /**
   * Phase state mapping di branch ZXGPON-MIB (.3902.1012.3.28.2.1.4)
   * verified di C300 V2.1.0 lapangan vs `show gpon onu state`:
   *
   *   3 = working/online   — ONU teregistrasi & lewat trafik
   *   4 = dying_gasp        — ONU baru kehilangan power
   *   6 = offline           — ONU mati / kabel putus
   *
   * Catatan: branch lain (.1082...3.3.1.5) sering balas 1 untuk semua ONU
   * yang sudah authorized — itu admin/auth state, BUKAN phase state real.
   * Selalu pakai branch ZXGPON .1012.3.28.2.1.4 untuk monitoring.
   */
  statusMap: {
    3: "online",
    4: "dying_gasp",
    6: "offline",
    1: "los",
    2: "unknown",
    5: "unknown",
  } as Record<number, string>,

  /**
   * Parse OID hasil walk → ekstrak (frame, slot, port, onuIndex).
   * ZTE format: <baseOid>.<oltIfIndex>.<onuIndex> (2 segments setelah base).
   *
   * Return null kalau format tidak match (mis. ifIndex bukan dari
   * GPON OLT card).
   */
  parseOnuIndex(
    oid: string,
    baseOid: string,
  ): {
    frame: number;
    slotFrame: number;
    slot: number;
    port: number;
    onuIndex: number;
  } | null {
    if (!oid.startsWith(baseOid + ".")) return null;
    const suffix = oid.slice(baseOid.length + 1);
    const parts = suffix.split(".").map(Number);
    if (parts.length < 2 || parts.some((n) => isNaN(n))) return null;

    const ifIndex = parts[0];
    const onuIndex = parts[1];
    const decoded = decodeOltIfIndex(ifIndex);
    if (!decoded) return null;

    return {
      frame: decoded.frame,
      slotFrame: decoded.frame,
      slot: decoded.slot,
      port: decoded.port,
      onuIndex,
    };
  },

  /**
   * Parse OID hasil walk service-port table:
   *   <baseOid>.<oltIfIndex>.<servicePortIndex>
   *
   * servicePortIndex format: 0x18<onuIndex>0100
   *   byte 24-31 = 0x18 (service-port marker)
   *   byte 16-23 = onuIndex (1-255)
   *   byte 0-15  = 0x0100 (vport.1 sub-service)
   *
   * Return null kalau format tidak match.
   */
  parseServicePortIndex(
    oid: string,
    baseOid: string,
  ): {
    frame: number;
    slot: number;
    port: number;
    onuIndex: number;
  } | null {
    if (!oid.startsWith(baseOid + ".")) return null;
    const suffix = oid.slice(baseOid.length + 1);
    const parts = suffix.split(".").map(Number);
    if (parts.length < 2 || parts.some((n) => isNaN(n))) return null;

    const ifIndex = parts[0];
    const spIndex = parts[1];
    const decoded = decodeOltIfIndex(ifIndex);
    if (!decoded) return null;

    const spMarker = (spIndex >>> 24) & 0xff;
    if (spMarker !== 0x18) return null;
    const onuIndex = (spIndex >>> 16) & 0xff;

    return {
      frame: decoded.frame,
      slot: decoded.slot,
      port: decoded.port,
      onuIndex,
    };
  },

  /**
   * Format CLI interface untuk PON port.
   * ZTE C300/C320: gpon-olt_<frame>/<slot>/<port>
   * Verified via `(config)#interface ?` output.
   */
  formatPonInterface(slotFrame: number, slot: number, port: number): string {
    return `gpon-olt_${slotFrame}/${slot}/${port}`;
  },

  /**
   * Format CLI interface untuk ONU spesifik.
   * ZTE C300/C320: gpon-onu_<frame>/<slot>/<port>:<onuIndex>
   */
  formatOnuInterface(
    slotFrame: number,
    slot: number,
    port: number,
    onuIndex: number,
  ): string {
    return `gpon-onu_${slotFrame}/${slot}/${port}:${onuIndex}`;
  },

  /**
   * Parse OID hasil walk ZXGPON-MIB (.3902.1012):
   *   <baseOid>.<zxGponIfIndex>.<onuIndex>
   *
   * Format ifIndex BEDA dari ZTE-AN — hex 0x10 SS PP 00.
   */
  parseZxGponOnuIndex(
    oid: string,
    baseOid: string,
  ): {
    frame: number;
    slot: number;
    port: number;
    onuIndex: number;
  } | null {
    if (!oid.startsWith(baseOid + ".")) return null;
    const suffix = oid.slice(baseOid.length + 1);
    const parts = suffix.split(".").map(Number);
    if (parts.length < 2 || parts.some((n) => isNaN(n))) return null;

    const ifIndex = parts[0];
    const onuIndex = parts[1];
    const decoded = decodeZxGponIfIndex(ifIndex);
    if (!decoded) return null;

    return {
      frame: decoded.frame,
      slot: decoded.slot,
      port: decoded.port,
      onuIndex,
    };
  },

  // Expose helpers untuk testing & SNMP explorer
  encodeOltIfIndex,
  decodeOltIfIndex,
  encodeZxGponIfIndex,
  decodeZxGponIfIndex,
};
