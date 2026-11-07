/** Presentation only: saved reader HTML, provenance and hashes remain unchanged. */
export function formatReviewedTypography(questionId: string, html: string): string {
  if (questionId !== "MOEX-113020-1301-Q074") return html;
  const formula = '<strong>Km,app＝Km × (1＋[I]/Ki)</strong>';
  let output = html.replace('常用寫法為' + formula + '，其中', '</p><div class="reviewed-equation" role="group" aria-label="表觀米氏常數公式"><span class="reviewed-equation-expression">' + formula + '</span></div><p>其中');
  output = output.replace('其中[I]是抑制劑濃度', '其中 Km,app 的 app 是 apparent（表觀）的縮寫；[I]是抑制劑濃度');
  // Only trusted text nodes, never attributes, URLs, image data or arbitrary user HTML.
  return output.split(/(<[^>]*>)/g).map(part => part.startsWith('<') ? part : part
    .replace(/Km,app/g, '<span class="reviewed-term">K<sub>m,app</sub></span>')
    .replace(/Vmax/g, '<span class="reviewed-term">V<sub>max</sub></span>')
    .replace(/Km/g, '<span class="reviewed-term">K<sub>m</sub></span>')
    .replace(/Ki/g, '<span class="reviewed-term">K<sub>i</sub></span>')
    .replace(/Michaelis–Menten/g, '<span class="reviewed-term">Michaelis–Menten</span>')
    .replace(/\[I\]/g, '<span class="reviewed-term">[I]</span>')
  ).join('');
}
