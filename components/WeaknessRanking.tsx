import { SectionStats } from "@/types/quiz";

function getSectionTags(section: SectionStats) {
  const tags: { label: string; tone: string }[] = [];

  if (section.overconfidence > 0) {
    tags.push({ label: "錯誤自信", tone: "bg-rose-100 text-rose-900" });
  }

  if (section.guessRisk > 0) {
    tags.push({ label: "猜對風險", tone: "bg-amber-100 text-amber-900" });
  }

  if (section.lowConfidence > 0) {
    tags.push({ label: "基礎不穩", tone: "bg-sky-100 text-sky-900" });
  }

  if (section.priorityScore >= 6) {
    tags.push({ label: "優先補弱", tone: "bg-violet-100 text-violet-900" });
  }

  return tags;
}

function repeatsSubject(section: SectionStats) {
  return section.section.replace(/\s+/g, "").startsWith(section.chapter.replace(/\s+/g, ""));
}

export function WeaknessRanking({ sections }: { sections: SectionStats[] }) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">弱點排行</h2>
          <p className="mt-2 text-sm text-slate-500">依新的考點分類整理本輪最需要補強的地方。</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {sections.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            目前還沒有足夠資料可以判定弱點排行。
          </div>
        ) : (
          sections.map((section, index) => (
            <article
              key={`${section.chapter}-${section.section}`}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
                      Top {index + 1}
                    </span>
                    {!repeatsSubject(section) ? (
                      <span className="text-sm text-slate-500">{section.chapter}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{section.section}</h3>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  優先分數 {section.priorityScore}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {getSectionTags(section).length === 0 ? (
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    持續觀察
                  </span>
                ) : (
                  getSectionTags(section).map((tag) => (
                    <span
                      key={`${section.chapter}-${section.section}-${tag.label}`}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${tag.tone}`}
                    >
                      {tag.label}
                    </span>
                  ))
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
