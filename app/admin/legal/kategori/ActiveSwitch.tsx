"use client";

/** Sakelar aktif/nonaktif kecil untuk baris tabel. */
export default function ActiveSwitch({
  isOn,
  isDisabled,
  label,
  onToggle,
}: {
  isOn: boolean;
  isDisabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      disabled={isDisabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        isOn ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          isOn ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
