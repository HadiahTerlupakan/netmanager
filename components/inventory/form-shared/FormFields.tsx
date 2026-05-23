"use client";

interface FormAlertProps {
  tone: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
}

const TONE_CLASS: Record<FormAlertProps["tone"], string> = {
  error:
    "p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400",
  success:
    "p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-400",
  warning:
    "p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-800 dark:text-yellow-400",
  info: "p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-800 dark:text-blue-400",
};

export function FormAlert({ tone, children }: FormAlertProps) {
  return <div className={TONE_CLASS[tone]}>{children}</div>;
}

interface TextFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  lockedNote?: string;
  min?: string;
  step?: string;
}

export function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  lockedNote,
  min,
  step,
}: TextFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <input
        type={type}
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        step={step}
      />
      {lockedNote && <LockedNote text={lockedNote} />}
    </div>
  );
}

interface TextAreaFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  lockedNote?: string;
  rows?: number;
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  lockedNote,
  rows = 3,
}: TextAreaFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        placeholder={placeholder}
        disabled={disabled}
      />
      {lockedNote && <LockedNote text={lockedNote} />}
    </div>
  );
}

interface JumlahFieldProps {
  value: string;
  onChange: (value: string) => void;
  satuan?: string;
  disabled?: boolean;
  lockedNote?: string;
  label?: string;
  max?: string;
}

export function JumlahField({
  value,
  onChange,
  satuan,
  disabled,
  lockedNote,
  label = "Jumlah *",
  max,
}: JumlahFieldProps) {
  return (
    <div>
      <label
        htmlFor="jumlah"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          id="jumlah"
          name="jumlah"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="0"
          min="1"
          max={max}
          disabled={disabled}
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
          {satuan || "pcs"}
        </span>
      </div>
      {lockedNote && <LockedNote text={lockedNote} />}
    </div>
  );
}

function LockedNote({ text }: { text: string }) {
  return (
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{text}</p>
  );
}
