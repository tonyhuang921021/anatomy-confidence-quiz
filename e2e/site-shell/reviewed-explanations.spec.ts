import { expect, test, type Page } from "@playwright/test";
import { canonicalQuestionBank } from "../../data/med1QuestionBank";
import index from "../../data/reviewedExplanationIndex.json";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "block" });
const batches = [...new Set(Object.values(index).map(item => item.batch))];
async function fixture(page: Page, ids: string[]) {
  await page.route("https://e2e.invalid/**", route => route.abort());
  await page.route("**/api/**", route => route.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}}));
  const questions = ids.map(id => canonicalQuestionBank.find(q => q.id === id)!);
  expect(questions.every(Boolean)).toBe(true);
  await page.addInitScript(({questions,ids}) => {
    if (localStorage.getItem("reviewed-fixture")) return;
    localStorage.setItem("reviewed-fixture","1");
    localStorage.setItem("anatomy-confidence-active-user-id","guest");
    localStorage.setItem("anatomy-confidence-current-session:guest",JSON.stringify({
      id:"reviewed-fixture",subject:"醫學（一）",startedAt:new Date().toISOString(),
      settings:{mode:"random",questionCount:ids.length,subjectFilter:"全部",feedbackMode:"full",stopAfterReview:true,enableKeyboardNavigation:true,enableFastAnswerMode:false},
      generatedQuestions:questions,questionOrder:ids,currentQuestionIndex:0,isReviewingAnswer:false,attempts:[]
    }));
  },{questions,ids});
  await page.goto("/quiz?resume=1&sessionId=reviewed-fixture");
}
for (const batch of batches) {
  test(`完成版圖文逐題顯示與原圖載入 ${batch}`,async ({page},info) => {
    test.setTimeout(600_000);
    const ids=Object.entries(index).filter(([,v])=>v.batch===batch).map(([id])=>id);
    await page.emulateMedia({reducedMotion:"reduce"});
    await fixture(page,ids);
    for (const [number,id] of ids.entries()) {
      const question=page.getByRole("group",{name:"作答題目",exact:true});
      await expect(question).toHaveAttribute("data-question-id",id);
      await question.getByRole("button").first().click();
      await page.getByRole("button",{name:"送出答案",exact:true}).click();
      const panel=page.locator(`[data-reviewed-question="${id}"]`);
      await expect(panel.locator('[data-reader-mode="short"]')).toBeVisible();
      await expect(panel.getByRole("button",{name:"簡解",exact:true})).toHaveAttribute("aria-pressed","true");
      const detail=panel.getByRole("button",{name:"詳解",exact:true});
      await detail.focus(); await page.keyboard.press("Enter");
      await expect(detail).toBeFocused();
      await expect(panel.locator('[data-reader-mode="detailed"]')).toBeVisible();
      const source=JSON.parse(readFileSync(`public/reviewed-explanations/${id}.json`,"utf8"));
      await expect(panel.locator("img")).toHaveCount(source.imageCount);
      // Source-authored image disclosures must be opened before their lazy images load.
      for (const disclosure of await panel.locator("details").filter({has: page.locator("img")}).all()) {
        if (await disclosure.getAttribute("open") === null) await disclosure.locator(":scope > summary").click();
      }
      for(const image of await panel.locator("img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.getByRole("button",{name:/重新替換詳解|用 AI 補詳解/})).toHaveCount(0);
      if(number===0 || id.endsWith("Q062") || id.endsWith("Q069") || id.endsWith("Q049")) {
        await panel.scrollIntoViewIfNeeded();
        await page.screenshot({path:`evidence/explanations/${info.project.name}-${id}.png`,fullPage:true});
      }
      await panel.getByRole("button",{name:"簡解",exact:true}).click();
      await expect(panel.locator("img")).toHaveCount(0);
      if(number<ids.length-1) await page.getByRole("button",{name:"下一題",exact:true}).filter({visible:true}).first().click();
    }
    await page.getByRole("button",{name:"查看結果",exact:true}).filter({visible:true}).first().click();
    await expect(page).toHaveURL(/\/results/);
    await page.getByRole("button",{name:/全部/}).first().click();
    await page.locator(".result-review-list details summary, .result-review-details").count();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
