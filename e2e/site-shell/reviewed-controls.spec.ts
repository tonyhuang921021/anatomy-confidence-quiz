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
 await page.getByRole("textbox",{name:"想找哪一題？"}).fill("MOEX-115020-2301-Q078");
 await expect(card).toHaveCount(1); await expect(card).toContainText("MOEX-115020-2301-Q078"); await card.locator('button[aria-controls^="search-result-details-"]').click();
 await card.getByRole("button",{name:"顯示答案與詳解"}).click();await card.getByRole("button",{name:"更多",exact:true}).click();
 await expect(card.getByRole("button",{name:"用 AI 補詳解",exact:true})).toBeVisible();
});
test("結果頁新詳解可切換且refresh保留作答紀錄",async({page},info)=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.addInitScript(()=>{
  const t=new Date().toISOString();
  localStorage.setItem("anatomy-confidence-active-user-id","guest");
  localStorage.setItem("anatomy-confidence-completed-sessions:guest",JSON.stringify([{id:"reviewed-result",subject:"醫學（二）",startedAt:t,completedAt:t,settings:{mode:"random",questionCount:1,subjectFilter:"藥理學"},questionOrder:["MOEX-112100-2301-Q051"],attempts:[{questionId:"MOEX-112100-2301-Q051",selectedAnswer:"A",correctAnswer:"D",isCorrect:false,confidence:3,answeredAt:t}]}]));
 });
 await page.goto("/results?sessionId=reviewed-result");
 const card=page.getByRole("region",{name:"題目回顧",exact:true}).locator('details[id^="review-all-"]').first();
 await card.locator("summary").click(); const reader=card.locator(".reviewed-explanation");
 await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
 await reader.getByRole("button",{name:"詳解",exact:true}).click();await expect(reader.locator("img")).toHaveCount(1);
 await card.getByRole("button",{name:"更多",exact:true}).click();
 await expect(card.getByRole("button",{name:/重新替換詳解|用 AI 補詳解/})).toHaveCount(0);
 await reader.scrollIntoViewIfNeeded();await page.screenshot({path:`evidence/explanations/${info.project.name}-results.png`});
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("anatomy-confidence-completed-sessions:guest")!)[0].attempts.length)).toBe(1);
});
