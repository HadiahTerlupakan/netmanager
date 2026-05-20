export const ZteOidRegistry = {
  system: {
    sysDescr: "1.3.6.1.2.1.1.1.0",
    sysUpTime: "1.3.6.1.2.1.1.3.0",
    sysName: "1.3.6.1.2.1.1.5.0",
  },
  gpon: {
    onuStatus: (
      slotFrame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) =>
      `1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.${slotFrame}.${slot}.${port}.${onuIndex}`,
    onuRxPower: (
      slotFrame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) =>
      `1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.2.${slotFrame}.${slot}.${port}.${onuIndex}`,
    onuTxPower: (
      slotFrame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) =>
      `1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.1.${slotFrame}.${slot}.${port}.${onuIndex}`,
    onuSerialNumber: (
      slotFrame: number,
      slot: number,
      port: number,
      onuIndex: number,
    ) =>
      `1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3.${slotFrame}.${slot}.${port}.${onuIndex}`,
    unregisteredOnuTable: "1.3.6.1.4.1.3902.1082.500.10.2.2.5.1",
    onuStatusTable: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2",
    onuSerialNumberTable: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3",
  },
  statusMap: {
    1: "online",
    2: "offline",
    3: "los",
    4: "dying_gasp",
    5: "unknown",
  } as Record<number, string>,

  parseOnuIndex(
    oid: string,
    baseOid: string,
  ): {
    slotFrame: number;
    slot: number;
    port: number;
    onuIndex: number;
  } | null {
    const suffix = oid.slice(baseOid.length + 1);
    const parts = suffix.split(".").map(Number);
    if (parts.length < 4) return null;
    return {
      slotFrame: parts[0],
      slot: parts[1],
      port: parts[2],
      onuIndex: parts[3],
    };
  },

  formatPonInterface(slotFrame: number, slot: number, port: number): string {
    return `gpon-olt_${slotFrame}/${slot}/${port}`;
  },

  formatOnuInterface(
    slotFrame: number,
    slot: number,
    port: number,
    onuIndex: number,
  ): string {
    return `gpon-onu_${slotFrame}/${slot}/${port}:${onuIndex}`;
  },
};
