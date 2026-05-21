export type GenieAcsDevice = Record<string, unknown> & {
  _id?: string;
  _deviceId?: {
    _ProductClass?: string;
    _SerialNumber?: string;
    _Manufacturer?: string;
    _OUI?: string;
  };
  _tags?: unknown;
  _lastInform?: unknown;
  _lastBoot?: unknown;
  _registered?: unknown;
};
