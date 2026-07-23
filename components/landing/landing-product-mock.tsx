import { cx } from "./landing-content";

/** Hero focal — a stylized dashboard mock built from CSS, no image asset. */
export function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-3xl" aria-hidden>
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(10,70,170,0.14),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(91,141,239,0.16),transparent_70%)]" />

      <div
        className={`rounded-[1.75rem] bg-zinc-900/[0.03] dark:bg-white/[0.04] p-1.5 ring-1 ring-zinc-900/[0.06] dark:ring-white/10 shadow-[0_40px_80px_-24px_rgba(24,24,27,0.28),0_12px_24px_-12px_rgba(24,24,27,0.1)] dark:shadow-[0_40px_80px_-24px_rgba(0,0,0,0.65)]`}
      >
        <div
          className={`overflow-hidden rounded-[1.35rem] ${cx.surface} ring-1 ${cx.ring}`}
        >
          <div
            className={`flex items-center gap-2 border-b ${cx.line} bg-zinc-50/80 dark:bg-zinc-950/50 px-4 py-3`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <div className="ml-3 flex-1">
              <div
                className={`mx-auto h-6 max-w-[220px] rounded-md ${cx.surface} ring-1 ${cx.ring}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-12">
            <div
              className={`col-span-3 hidden border-r ${cx.line} bg-zinc-50/50 dark:bg-zinc-950/40 p-4 sm:block`}
            >
              <div className="mb-5 h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex h-8 items-center rounded-lg px-2 ${
                      i === 1
                        ? "bg-[#0a46aa]/[0.08] ring-1 ring-[#0a46aa]/15 dark:bg-[#5b8def]/10 dark:ring-[#5b8def]/20"
                        : ""
                    }`}
                  >
                    <div
                      className={`h-2 rounded ${
                        i === 1
                          ? "w-14 bg-[#0a46aa]/60 dark:bg-[#5b8def]/60"
                          : "w-16 bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 space-y-4 p-4 sm:col-span-9 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="mb-2 h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-4 w-36 rounded bg-zinc-300/80 dark:bg-zinc-600" />
                </div>
                <div className="h-8 w-24 rounded-full bg-[#0a46aa] dark:bg-[#1a5bc4]" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  "bg-emerald-50 dark:bg-emerald-500/10",
                  "bg-sky-50 dark:bg-sky-500/10",
                  "bg-violet-50 dark:bg-violet-500/10",
                ].map((tint) => (
                  <div
                    key={tint}
                    className={`rounded-xl ${tint} p-3 ring-1 ring-zinc-900/[0.04] dark:ring-white/5`}
                  >
                    <div className="mb-2 h-1.5 w-10 rounded bg-zinc-300/70 dark:bg-zinc-600" />
                    <div className="h-3.5 w-14 rounded bg-zinc-400/60 dark:bg-zinc-500" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                <div
                  className={`col-span-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 p-3 ring-1 ring-zinc-900/[0.04] dark:ring-white/5`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="h-2 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-2 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                  <div className="flex h-24 items-end gap-1.5 px-1">
                    {[40, 55, 35, 70, 50, 85, 60, 75, 45, 90, 65, 80].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-[#0a46aa]/70 to-[#0a46aa]/25 dark:from-[#5b8def]/70 dark:to-[#5b8def]/20"
                          style={{ height: `${h}%` }}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div
                  className={`col-span-2 space-y-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 p-3 ring-1 ring-zinc-900/[0.04] dark:ring-white/5`}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="h-1.5 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-1.5 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
