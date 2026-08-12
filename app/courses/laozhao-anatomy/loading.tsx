export default function Loading() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-main)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="h-5 w-24 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
        <div className="mt-12 max-w-2xl">
          <div className="h-3 w-28 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
          <div className="mt-4 h-12 w-64 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
          <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="border-t border-slate-200/80 pt-5">
            <div className="h-8 w-32 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
            <div className="mt-5 h-12 w-full animate-pulse rounded-[6px] bg-slate-200/70 motion-reduce:animate-none" />
            <div className="mt-7 space-y-5">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-slate-200/70 pb-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <div className="aspect-video animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
                  <div className="space-y-3 pt-1">
                    <div className="h-5 w-4/5 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
                    <div className="h-4 w-3/5 animate-pulse rounded-[4px] bg-slate-200/70 motion-reduce:animate-none" />
                    <div className="h-3 w-2/5 animate-pulse rounded-[4px] bg-slate-200/70 motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <aside className="border-t border-slate-200/80 pt-5">
            <div className="h-7 w-32 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
            <div className="mt-5 h-24 animate-pulse rounded-[6px] bg-slate-200/70 motion-reduce:animate-none" />
            <div className="mt-10 h-7 w-28 animate-pulse rounded-[4px] bg-slate-200/80 motion-reduce:animate-none" />
          </aside>
        </div>
      </div>
    </main>
  );
}
