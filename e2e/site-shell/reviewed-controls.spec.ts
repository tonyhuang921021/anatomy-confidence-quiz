import { expect, test } from "@playwright/test";
test.use({serviceWorkers:"block"});
test.beforeEach(async({page})=>{
 await page.route("https://e2e.invalid/**",r=>r.abort());
 await page.route("**/api/**",r=>r.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}}));
});
test("搜尋新詳解保留簡詳切換與補充，移除替換；舊題仍有AI入口",async({page})=>{
 await page.goto("/search?query=MOEX-112100-2301-Q069");
 const card=page.locator("article.search-result-card"); await expect(card).toHaveCount(1);
 await card.locator('button[aria-controls^="search-result-details-"]').click();
 await card.getByRole("button",{name:"顯示答案與詳解"}).click();
 const reader=card.locator(".reviewed-explanation"); await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
 await reader.getByRole("button",{name:"詳解",exact:true}).focus(); await page.keyboard.press("Enter");
 await expect(reader.locator('[data-reader-mode="detailed"]')).toContainText("一律給分");
 await expect(card.getByRole("button",{name:"補充",exact:true})).toBeVisible();
 await card.getByRole("button",{name:"更多",exact:true}).click();
 await expect(card.getByRole("button",{name:/重新替換詳解|用 AI 補詳解/})).toHaveCount(0);
 await reader.getByRole("button",{name:"簡解",exact:true}).click();
 await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
 await page.getByRole("textbox",{name:"想找哪一題？"}).fill("MOEX-112020_2301-Q001");
 await expect(card).toHaveCount(1); await expect(card).toContainText("MOEX-112020_2301-Q001"); await card.locator('button[aria-controls^="search-result-details-"]').click();
 await card.getByRole("button",{name:"顯示答案與詳解"}).click();await card.getByRole("button",{name:"更多",exact:true}).click();
 await expect(card.getByRole("button",{name:"用 AI 補詳解",exact:true})).toBeVisible();
});
for (const questionId of ["MOEX-112100-2301-Q051", "MOEX-113020-1301-Q001", "MOEX-114020-1301-Q077", "MOEX-115020-1301-Q001", "moex-med1-supplement-v5-113020-1301-003", "moex-med1-supplement-v5-113090-1301-049", "moex-med1-supplement-v5-114020-1301-053", "missing-2024-2-113090-1301-q053", "moex-med1-supplement-v5-115020-1301-095", "moex-med1-supplement-v5-115020-1301-098"]) {
 test(`結果頁 ${questionId} 使用新詳解並保留完整舊紀錄`,async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(({questionId})=>{
   if (localStorage.getItem("reviewed-result-seeded")) return;
   localStorage.setItem("reviewed-result-seeded","1");
   const t="2026-10-01T00:00:00.000Z";
   localStorage.setItem("anatomy-confidence-active-user-id","guest");
   localStorage.setItem("anatomy-confidence-completed-sessions:guest",JSON.stringify([{id:"reviewed-result",subject:"醫學（一）",startedAt:t,completedAt:t,settings:{mode:"random",questionCount:1,subjectFilter:"全部"},questionOrder:[questionId],attempts:[{questionId,selectedAnswer:"A",correctAnswer:"D",isCorrect:false,confidence:3,answeredAt:t}]}]));
  },{questionId});
  await page.goto("/results?sessionId=reviewed-result");
  const before=await page.evaluate(()=>localStorage.getItem("anatomy-confidence-completed-sessions:guest"));
  const card=page.getByRole("region",{name:"題目回顧",exact:true}).locator('details[id^="review-all-"]').first();
  await card.locator("summary").click();
  const reader=card.locator(".reviewed-explanation");
  await expect(reader).toHaveAttribute("data-reviewed-question",questionId);
  await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
  await reader.getByRole("button",{name:"詳解",exact:true}).click();
  await expect(reader.locator('[data-reader-mode="detailed"]')).toBeVisible();
  await card.getByRole("button",{name:"更多",exact:true}).click();
  await expect(card.getByRole("button",{name:/重新替換詳解|用 AI 補詳解/})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(before);
  await page.reload();
  await expect(page.getByRole("region",{name:"題目回顧",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(before);
 });
}
