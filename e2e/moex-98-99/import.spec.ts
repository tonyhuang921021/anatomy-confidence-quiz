import { expect, test, type Page } from "@playwright/test";
import payload from "../../data/sources/moex_98_99_official_questions.json";

async function localOnly(page: Page) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok:true, stats:[], overrides:{}, count:0, cards:[], reactions:[] } });
    return route.continue();
  });
}

test("eight new old-system papers appear and a real 100-question session starts", async ({ page }, info) => {
  await localOnly(page);
  await page.goto("/simulation");
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
  const select=page.locator("#simulation-paper");
  for (const subject of ["醫學（一）", "醫學（二）"]) {
    await page.getByRole("button",{name:new RegExp(subject.replace(/[（）]/g,"\\$&"))}).click();
    for (const paper of payload.papers.filter(p=>p.subject===subject)) {
      await expect(select.locator(`option[value="${paper.key}"]`)).toHaveCount(1);
    }
  }
  await page.getByRole("button",{name:/醫學（一）/}).click();
  await select.selectOption("098020-1101");
  await expect(page.getByText(/98 年舊制/)).toBeVisible();
  await expect(page.getByText(/微生物免疫、寄生蟲及公共衛生/)).toBeVisible();
  await page.screenshot({path:`reports/moex-98-99/${info.project.name}-year-menu.png`,fullPage:true});
  await page.getByRole("button",{name:"開始 100 題模擬考",exact:true}).click();
  await expect(page.locator('[data-question-id="MOEX-098020-1101-Q001"]')).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("anatomy-confidence-current-session:guest") || "null"));
  expect(stored.questionOrder).toHaveLength(100);
  expect(new Set(stored.questionOrder).size).toBe(100);
  await page.screenshot({path:`reports/moex-98-99/${info.project.name}-started-paper.png`,fullPage:true});
});

test("original figures, Yangming source links and stored historical answers survive reload", async ({ page }, info) => {
  await localOnly(page);
  const question=payload.questions.find(q=>q.id==="MOEX-099010-2101-Q091")!;
  const history=JSON.stringify([{id:"old-record",subject:"醫學（一）",startedAt:"2026-10-01T00:00:00Z",completedAt:"2026-10-01T01:00:00Z",settings:{mode:"simulation",subjectFilter:"醫學（一）",questionCount:1,selectedPaperKey:"115090-1301"},questionOrder:["MOEX-115090-1301-Q001"],attempts:[{questionId:"MOEX-115090-1301-Q001",selectedAnswer:"A",correctAnswer:"C",isCorrect:false,confidence:3,answeredAt:"2026-10-01T00:01:00Z"}]}]);
  await page.addInitScript(({question,history})=>{
    if(localStorage.getItem("moex9899-seeded"))return;
    localStorage.setItem("moex9899-seeded","true");
    localStorage.setItem("anatomy-confidence-active-user-id","guest");
    localStorage.setItem("anatomy-confidence-completed-sessions:guest",history);
    localStorage.setItem("anatomy-confidence-current-session:guest",JSON.stringify({id:"moex9899-figure",subject:question.subject,startedAt:new Date().toISOString(),settings:{mode:"random",questionCount:1,subjectFilter:question.subject,feedbackMode:"full",stopAfterReview:true,enableConfidenceCalibration:false},generatedQuestions:[question],questionOrder:[question.id],currentQuestionIndex:0,isReviewingAnswer:false,attempts:[]}));
  },{question,history});
  await page.goto("/quiz?resume=1&sessionId=moex9899-figure");
  const card=page.locator(`[data-question-id="${question.id}"]`);
  await expect(card).toBeVisible();
  const image=card.locator('img').first();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await card.getByRole("button").filter({hasText:question.options[question.answer as "A"]}).first().click();
  await page.getByRole("button",{name:"送出答案",exact:true}).click();
  await page.getByRole("button",{name:"陽明",exact:true}).click();
  await expect(page.getByRole("link",{name:"96～100 年詳解原檔"})).toHaveAttribute("href",/0B1fUmKbhv5stWlNHYWJ6eVB3OGs/);
  await expect(page.getByText(/尚未核實合輯頁碼/)).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(history);
  await page.screenshot({path:`reports/moex-98-99/${info.project.name}-figure-and-source.png`,fullPage:true});
  await page.reload();
  expect(await page.evaluate(()=>localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(history);
});
