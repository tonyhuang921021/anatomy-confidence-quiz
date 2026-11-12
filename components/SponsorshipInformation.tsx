/** Public terms approved by the owner. Payment remains disabled. */
export function SponsorshipInformation({ expanded = false }: { expanded?: boolean }) {
  return <details className="review-information information-accordion" id="information-title" open={expanded || undefined}>
    <summary className="information-summary"><span><span className="eyebrow">BEFORE YOU SUPPORT</span><span className="information-summary-title">贊助前資訊</span><span className="information-summary-note">所有贊助皆為自願、無償支持，是否贊助由你自由決定。刷題與複習維持免費，不會因贊助與否而增加或減少任何功能。款項用於支持網站維護，展開可查看詳細說明。</span></span><span className="accordion-symbol" aria-hidden="true">＋</span></summary>
    <div className="information-body">
      <div className="section-heading"><div><p className="eyebrow">BEFORE YOU SUPPORT</p><h2>贊助前，先把資訊說清楚。</h2></div></div>
      <p className="section-description">以下說明不需登入即可閱讀。付款尚未開放，不會建立訂單或扣款。</p>
      <div className="information-sections">
        <details id="service-information" open={expanded || undefined}><summary><span>01</span> 服務內容</summary><div className="information-copy"><p>本網站提供醫師一階國考刷題與複習功能。刷題和複習維持免費，贊助不提供額外功能或會員權益。</p></div></details>
        <details id="sponsorship-information" open={expanded || undefined}><summary><span>02</span> 贊助用途與金額</summary><div className="information-copy"><p>贊助完全自願，款項用於網站維護、主機、資料庫及必要服務費用。</p><p>最低贊助金額為新台幣 100 元，可選 NT$ 100、300、500，或自行輸入整數金額。網站不另設贊助上限；實際交易仍須符合金流服務與付款工具的額度限制。</p></div></details>
        <details id="terms-information" open={expanded || undefined}><summary><span>03</span> 服務條款</summary><div className="information-copy"><p>贊助為自願、無償支持，不是購買額外功能或會員權益。是否贊助不影響原有免費刷題和複習功能。</p><p>贊助款項用於網站維護、主機、資料庫及必要服務費用。贊助前請閱讀本頁的贊助方式、隱私政策與退款政策。</p><p>付款尚未開放，目前不會建立訂單或扣款。</p></div></details>
        <details id="privacy-information" open={expanded || undefined}><summary><span>04</span> 隱私政策</summary><div className="information-copy"><p>名稱和金額分開詢問是否公開，預設都不公開；可以匿名或使用暱稱。不會自動以付款姓名、帳號姓名或 Email 作為公開名稱。</p><p>目前填寫的金額、暱稱與選項只保留在當前頁面，不會送出或儲存，重新整理後即清除。本頁不收集信用卡資料。</p><p>聯絡資料只用於回覆和處理問題。可來信要求查詢、更正或撤回公開同意。</p></div></details>
        <details id="refund-information" open={expanded || undefined}><summary><span>05</span> 退款政策</summary><div className="information-copy"><p>贊助完成後，單純改變心意不另外提供退款。若有重複扣款、交易異常或依法應返還款項等情況，請來信聯繫處理；依法享有的權利不受影響。</p><p>申請時請提供訂單編號、付款日期、金額及問題說明，不要提供完整卡號、驗證碼或密碼。</p><p>收到完整資料後，3 個工作天內回覆處理進度；退款實際入帳時間依金流和銀行作業而定。</p></div></details>
        <details id="contact-information" open={expanded || undefined}><summary><span>06</span> 聯絡資訊</summary><div className="information-copy"><p>網站、贊助與退款問題，請聯絡 <a href="mailto:tonyhuang921021@gmail.com">tonyhuang921021@gmail.com</a>。</p><p>收到完整資料後，3 個工作天內回覆處理進度。</p></div></details>
        <details id="operator-information" open={expanded || undefined}><summary><span>07</span> 營運資訊</summary><div className="information-copy"><p>網站名稱：一階醫師國考刷題測驗。</p><p>公開營運名稱：<strong>sinj</strong>。</p><p>聯絡信箱：<a href="mailto:tonyhuang921021@gmail.com">tonyhuang921021@gmail.com</a></p></div></details>
      </div>
    </div>
  </details>;
}
