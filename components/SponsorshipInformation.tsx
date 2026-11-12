/** Review-only factual copy. Unconfirmed policy fields must remain visibly pending. */
export function SponsorshipInformation() {
  return <details className="review-information information-accordion" id="information-title">
    <summary className="information-summary"><span><span className="eyebrow">BEFORE YOU SUPPORT</span><span className="information-summary-title">贊助前資訊</span><span className="information-summary-note">所有贊助皆為自願、無償支持，是否贊助由你自由決定。刷題與複習維持免費，不會因贊助與否而增加或減少任何功能。款項用於支持網站維護，展開可查看詳細說明。</span></span><span className="accordion-symbol" aria-hidden="true">＋</span></summary>
    <div className="information-body">
    <div className="section-heading"><div><p className="eyebrow">BEFORE YOU SUPPORT</p><h2>贊助前，先把資訊說清楚。</h2></div><span className="review-badge">候選內容 · 待確認</span></div>
    <p className="section-description">以下七項說明不需登入即可閱讀。目前仍在金流申請審核中，不接受正式付款；標示「待確認」的欄位尚未定案。</p>
    <div className="information-sections">
      <details id="service-information"><summary><span>01</span> 服務內容</summary><div className="information-copy"><p>本網站提供醫師一階國考刷題與複習功能。所有原有功能維持免費，贊助不提供額外功能、內容或權限。</p><p>你可以自由決定是否支持；不贊助也能繼續使用原有免費功能。</p></div></details>
      <details id="sponsorship-information"><summary><span>02</span> 贊助用途與金額</summary><div className="information-copy"><p>本贊助為自願、無償支持，款項用於本網站維護與營運相關支出，例如主機、資料庫及必要服務費用。</p><p>每筆最低贊助金額為新台幣 100 元，可選 NT$ 100／300／500，或自行輸入金額。目前僅供預覽，不會建立訂單或扣款。</p><p>網站不另設贊助上限；付款方式支援的額度與規則，會在金流開放前確認並清楚標示。</p></div></details>
      <details id="terms-information"><summary><span>03</span> 服務條款 <small>候選</small></summary><div className="information-copy"><p>贊助不屬於購買付費題庫、會員或額外服務。本頁目前僅供審閱，不構成已開放的付款服務。</p><p className="pending-field"><strong>待核：正式條款內容</strong>金流開放方式、服務使用條件及退款相關條款，需完成核實與確認後再公布正式版本。</p></div></details>
      <details id="privacy-information"><summary><span>04</span> 隱私政策 <small>候選</small></summary><div className="information-copy"><p>本頁的金額、暱稱及公開選項只在當前頁面預覽，不會送出或儲存，也不收集信用卡資料。</p><p>公開名稱與贊助金額分別取得同意，預設皆不公開。不以付款真實姓名、帳號姓名或 Email 自動作為公開名稱；TEST 測試訂單不列入正式名單或收入。</p><p className="pending-field"><strong>待核：正式資料處理說明</strong>正式收款所需資料、蒐集目的、金流或其他第三方接收範圍、保存期限、查詢／更正／刪除及撤回公開同意的方式，仍需依實際資料流程確認。</p></div></details>
      <details id="refund-information"><summary><span>05</span> 退款政策 <small>待確認</small></summary><div className="information-copy"><p>目前不接受正式付款。本區為退款政策候選欄位，尚未建立對外退款承諾。</p><p className="pending-field"><strong>待確認：退款條件與處理流程</strong>適用情況、申請期限、需要提供的資料、受理與處理時間、退回方式及費用負擔，均待定案。</p><p>重複扣款、誤扣等付款異常，與贊助者自行改變心意的申請會分開處理。退款期限、回覆時間及實際費用仍待確認，不先承諾退款金額或收取固定比例費用。</p><p>退款問題可來信至下方客服信箱。請提供訂單編號、付款日期、金額及問題說明；不要寄送完整卡號、驗證碼或帳號密碼。</p></div></details>
      <details id="contact-information"><summary><span>06</span> 聯絡資訊</summary><div className="information-copy"><p>贊助與網站問題，請聯絡 <a href="mailto:tonyhuang921021@gmail.com">tonyhuang921021@gmail.com</a>。</p><p className="pending-field"><strong>待確認：回覆時間</strong>客服受理與預計回覆時間尚未定案。</p></div></details>
      <details id="operator-information"><summary><span>07</span> 營運資訊</summary><div className="information-copy"><p>網站名稱：一階醫師國考刷題測驗。</p><p>公開營運名稱：<strong>sinj</strong>。</p><p>金流登記及信用卡帳單顯示名稱會另行核對，不以公開暱稱代替實際收款登記。</p></div></details>
    </div>
    </div>
  </details>;
}
