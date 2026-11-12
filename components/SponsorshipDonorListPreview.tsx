/** Intentionally has no data input: this preview never invents donors or reads TEST orders. */
export function SponsorshipDonorListPreview({ id = "donor-list-heading" }: { id?: string }) {
  return <section className="donor-list-preview" aria-labelledby={id}>
    <div className="donor-list-heading"><div><p>WITH YOUR PERMISSION</p><h2 id={id}>贊助者名單</h2></div></div>
    <div className="donor-list-empty"><span className="donor-list-symbol" aria-hidden="true">♡</span><h3>目前沒有公開的贊助紀錄</h3><p>只有經本人同意公開的正式贊助，才會顯示在名單中。</p></div>
  </section>;
}
