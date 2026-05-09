import { SectionStats } from "@/types/quiz";

type WeaknessRankingProps = {
  sections: SectionStats[];
  title?: string;
};

function buildTags(section: SectionStats) {
  const tags: string[] = [];
  if (section.overconfidence > 0) tags.push("錯誤自信");
  if (section.guessRisk > 0) tags.push("猜對風險");
  if (section.wrong > 0 && section.averageConfidence <= 3) tags.push("基礎不穩");
  if (section.wrong > 0 && section.averageConfidence <= 2) tags.push("優先補弱");
  return tags;
}

export function WeaknessRanking({
  sections,
  title = "最需要補弱的小節"
}: WeaknessRankingProps) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">依 priorityScore 排序，先抓最需要補的地方。</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {sections.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            這輪還沒有足夠資料可排名。
          </div>
        ) : (
          sections.map((section, index) => (
            <article
              key={`${section.chapter}-${section.section}`}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                      TOP {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-500">{section.chapter}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{section.section}</h3>
                </div>
                <div className="rounded-2xl bg-rose-100 px-4 py-3 text-right text-rose-800">
                  <p className="text-xs font-medium">priorityScore</p>
                  <p className="text-2xl font-bold">{section.priorityScore}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  total <span className="font-semibold">{section.total}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  wrong <span className="font-semibold">{section.wrong}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  averageConfidence <span className="font-semibold">{section.averageConfidence}</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  overconfidence <span className="font-semibold">{section.overconfidence}</span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {buildTags(section).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
