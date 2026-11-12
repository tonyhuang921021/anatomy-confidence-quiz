/** Intentionally has no data input: this preview never invents donors or reads TEST orders. */
export function SponsorshipDonorListPreview({ id = "donor-list-heading" }: { id?: string }) {
  return <section className="donor-list-preview" aria-labelledby={id}>
    <div className="donor-list-heading"><div><p>WITH YOUR PERMISSION</p><h2 id={id}>贊助者名單</h2></div><span>版面預覽</span></div>
    <div className="donor-list-empty"><span className="donor-list-symbol" aria-hidden="true">♡</span><h3>公開名單準備中</h3><p>目前尚未連接正式公開資料，不顯示任何贊助紀錄。</p></div>
  </section>;
}
