/**
 * Daftar timezone yang didukung untuk pengaturan umum
 * Format: { value: 'IANA_timezone', label: '(GMT+X) City/Region', offset: '+XX:00' }
 */

export interface TimezoneOption {
  value: string; // IANA timezone (e.g., 'Asia/Jakarta')
  label: string; // Display label (e.g., '(GMT+7) Jakarta - WIB')
  offset: string; // UTC offset (e.g., '+07:00')
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // UTC
  {
    value: "UTC",
    label: "(GMT+0) UTC - Universal Coordinated Time",
    offset: "+00:00",
  },

  // Indonesia
  {
    value: "Asia/Jakarta",
    label: "(GMT+7) Jakarta - WIB (Indonesia Barat)",
    offset: "+07:00",
  },
  {
    value: "Asia/Makassar",
    label: "(GMT+8) Makassar - WITA (Indonesia Tengah)",
    offset: "+08:00",
  },
  {
    value: "Asia/Jayapura",
    label: "(GMT+9) Jayapura - WIT (Indonesia Timur)",
    offset: "+09:00",
  },

  // Asia Tenggara
  { value: "Asia/Singapore", label: "(GMT+8) Singapore", offset: "+08:00" },
  {
    value: "Asia/Kuala_Lumpur",
    label: "(GMT+8) Kuala Lumpur - Malaysia",
    offset: "+08:00",
  },
  {
    value: "Asia/Bangkok",
    label: "(GMT+7) Bangkok - Thailand",
    offset: "+07:00",
  },
  {
    value: "Asia/Ho_Chi_Minh",
    label: "(GMT+7) Ho Chi Minh - Vietnam",
    offset: "+07:00",
  },
  {
    value: "Asia/Manila",
    label: "(GMT+8) Manila - Philippines",
    offset: "+08:00",
  },

  // Asia Timur
  { value: "Asia/Tokyo", label: "(GMT+9) Tokyo - Japan", offset: "+09:00" },
  {
    value: "Asia/Seoul",
    label: "(GMT+9) Seoul - South Korea",
    offset: "+09:00",
  },
  { value: "Asia/Hong_Kong", label: "(GMT+8) Hong Kong", offset: "+08:00" },
  {
    value: "Asia/Shanghai",
    label: "(GMT+8) Shanghai - China",
    offset: "+08:00",
  },
  { value: "Asia/Taipei", label: "(GMT+8) Taipei - Taiwan", offset: "+08:00" },

  // Australia
  {
    value: "Australia/Sydney",
    label: "(GMT+10/+11) Sydney - Australia",
    offset: "+10:00",
  },
  {
    value: "Australia/Melbourne",
    label: "(GMT+10/+11) Melbourne - Australia",
    offset: "+10:00",
  },
  {
    value: "Australia/Perth",
    label: "(GMT+8) Perth - Australia",
    offset: "+08:00",
  },

  // Asia Selatan & Barat
  {
    value: "Asia/Kolkata",
    label: "(GMT+5:30) Mumbai/Delhi - India",
    offset: "+05:30",
  },
  { value: "Asia/Dubai", label: "(GMT+4) Dubai - UAE", offset: "+04:00" },

  // Eropa
  { value: "Europe/London", label: "(GMT+0/+1) London - UK", offset: "+00:00" },
  {
    value: "Europe/Paris",
    label: "(GMT+1/+2) Paris - France",
    offset: "+01:00",
  },
  {
    value: "Europe/Berlin",
    label: "(GMT+1/+2) Berlin - Germany",
    offset: "+01:00",
  },
  {
    value: "Europe/Amsterdam",
    label: "(GMT+1/+2) Amsterdam - Netherlands",
    offset: "+01:00",
  },

  // Amerika
  {
    value: "America/New_York",
    label: "(GMT-5/-4) New York - US Eastern",
    offset: "-05:00",
  },
  {
    value: "America/Los_Angeles",
    label: "(GMT-8/-7) Los Angeles - US Pacific",
    offset: "-08:00",
  },
  {
    value: "America/Chicago",
    label: "(GMT-6/-5) Chicago - US Central",
    offset: "-06:00",
  },
];

/**
 * Default timezone jika tidak ada setting
 */
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/**
 * Get timezone option by value
 */
export function getTimezoneOption(value: string): TimezoneOption | undefined {
  return TIMEZONE_OPTIONS.find((tz) => tz.value === value);
}

/**
 * Get formatted label for timezone value
 */
export function getTimezoneLabel(value: string): string {
  const option = getTimezoneOption(value);
  return option?.label || value;
}
