import { expect, test } from "@playwright/test";
const questionId = "MOEX-114020-1301-Q077";
const note = { id:"credit-note", title:"給分規則回歸筆記", subject:"生物化學", tags:[], questionLinkCount:1, createdAt:"2026-10-01T00:00:00Z", updatedAt:"2026-10-01T00:00:00Z", rawMarkdown:`[question-note id="${questionId}"]`, questionLinks:[{questionId,relationType:"related"}] };
test.use({ serviceWorkers:"block" });
test.beforeEach(async({page})=>{
 await page.route("https://e2e.invalid/**",r=>r.abort());
 await page.route("**/api/**",r=>r.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[],collections:[]}}));
 await page.route("**/api/study-notes?**",r=>r.fulfill({json:new URL(r.request().url()).searchParams.has("id")?{ok:true,note}:{ok:true,notes:[note]}}));
 await page.route("**/api/question-supplement-cards?**",r=>r.fulfill({json:{ok:true,cards:[],reactions:[],count:0,recentCards:[{id:"credit-card",questionId,subject:"生物化學",contentPreview:"給分規則",updatedAt:note.updatedAt}]}}));
 await page.addInitScript(()=>{
  const session={access_token:"student-access-token",refresh_token:"student-refresh-token",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",user:{id:"student-user",email:"student@example.test",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{display_name:"測試使用者"},created_at:"2026-08-26T00:00:00Z"}};
  localStorage.setItem("medQuizAuthSessionSnapshot",JSON.stringify(session));
  localStorage.setItem("medQuizAutomaticCloudSync:student-user",String(Date.now()));
 });
});
test("筆記內嵌題目及便利貼呈現一律給分",async({page})=>{
 await page.goto("/notes/credit-note");
 const card=page.locator(".study-note-question-card").first();
 await card.getByRole("button",{name:/看題目/}).click();
 await card.getByRole("button",{name:"看答案與詳解",exact:true}).click();
 await expect(card.getByText("答案：一律給分",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"開啟題目便利貼"}).click();
 const sticky=page.locator(".app-floating-above-mobile-nav article").filter({hasText:questionId});
 await sticky.getByRole("button",{name:"看詳解",exact:true}).click();
 await expect(sticky.getByText("答案：一律給分",{exact:true})).toBeVisible();
});
test("科目筆記考古題抽屜呈現一律給分",async({page})=>{
 await page.goto(`/notes/subject/${encodeURIComponent("生物化學")}`);
 await page.getByRole("button",{name:`打開 ${note.title} 的考古題`}).click();
 const card=page.locator("article").filter({hasText:questionId});
 await card.locator("summary").click();
 await expect(card.getByText("答案：一律給分",{exact:true})).toBeVisible();
});
