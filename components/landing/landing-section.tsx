import { cx } from "./landing-content";

/** Small uppercase label above section titles. */
export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  );
}

/** Section heading with balanced wrapping and tight display tracking. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className={`mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl ${cx.ink}`}
    >
      {children}
    </h2>
  );
}
