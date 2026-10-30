import { getReviewedExplanationSupplement } from '@/lib/reviewedExplanationSupplements';
export function ReviewedExplanationSupplement({questionId}:{questionId:string}) {
  const item=getReviewedExplanationSupplement(questionId); if(!item) return null;
  return <section className="mt-5 min-w-0 max-w-full" aria-label="經核對的延伸比較">
    <h4 className="font-bold text-teal-900">延伸比較</h4><p className="my-2 leading-7">{item.note}</p>
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200" role="region" aria-label="比較表，可橫向捲動" tabIndex={0}>
      <table className="min-w-max border-collapse text-left text-sm leading-6"><thead><tr>{item.headers.map(h=><th key={h} scope="col" className="bg-teal-50 px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{item.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className="max-w-64 whitespace-normal border-t px-3 py-2">{cell}</td>)}</tr>)}</tbody></table>
    </div>
  </section>;
}
