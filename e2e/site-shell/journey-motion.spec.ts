import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function isolate(page: Page) {
  await page.route("https://e2e.invalid/**", route => route.abort());
  await page.route("**/api/**", route => route.fulfill({ json: {
    ok: true, points: [], messages: [], hasMore: false, nextCursor: null,
    stats: [], overrides: {}, count: 0, cards: [], reactions: [],
    explanation: { questionId: "local-ui-check", body: "這段解析僅用於本機互動驗收。展開時保持閱讀位置，收合後繼續作答。", assets: [], sections: [] }
  } }));
}
async function home(page: Page) {
  await isolate(page);
  await page.goto("/");
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
  await expect(page.getByRole("heading", {name: "國考刷題", exact: true})).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("首頁進場與續作視窗：可讀、鍵盤焦點與快速開關", async ({page}, info) => {
  await home(page);
  const entry = page.locator('[data-home-enter="launches"]');
  const frame = await entry.evaluate(el => {
    const a = el.getAnimations()[0];
    if (!a) throw new Error("首頁進場動畫沒有執行");
    a.pause(); a.currentTime = 140;
    return {opacity: Number(getComputedStyle(el).opacity), transform: getComputedStyle(el).transform};
  });
  expect(frame.opacity).toBeGreaterThanOrEqual(0.75);
  expect(frame.transform).not.toBe("none");
  await page.screenshot({path:`evidence/motion/journey/home-${info.project.name}-mid.png`});
  await entry.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
  const resume = page.locator('.home-continue-button');
  await resume.focus();
  await page.keyboard.down("Space");
  await expect.poll(()=>resume.evaluate(el=>getComputedStyle(el).transform)).not.toBe("none");
  await page.keyboard.up("Space");
  const panel = page.getByRole("dialog",{name:"可繼續的測驗"});
  const close = page.getByRole("button",{name:"關閉可繼續測驗"});
  await expect(panel).toBeVisible(); await expect(close).toBeFocused();
  await expect(panel).toContainText("目前沒有進行中的測驗");
  await page.keyboard.press("Shift+Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await expect(resume).toBeFocused();
  await page.keyboard.press("Enter"); await expect(panel).toBeVisible();
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  await expect(resume).toBeFocused();
  await noOverflow(page);
});

test("首頁與共用導覽 reduced motion 保留操作、沒有位移影格", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await home(page);
  await page.locator('.home-continue-button').click();
  await expect(page.getByRole("dialog",{name:"可繼續的測驗"})).toBeVisible();
  const check = async () => expect(await page.evaluate(() => document.getAnimations().flatMap(a =>
    (a.effect as KeyframeEffect).getKeyframes()).filter(f => f.transform && f.transform !== "none"))).toEqual([]);
  await check();
  await page.keyboard.press("Escape");
  const nav = page.getByRole("button",{name:"開啟導覽",exact:true});
  await nav.click(); await expect(page.getByRole("dialog",{name:"主要導覽"})).toBeVisible(); await check();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("公開學習頁面與共用動效覆蓋，不影響版面或內容", async ({page},info) => {
  test.setTimeout(120_000);
  await isolate(page);
  for (const route of ["/start","/simulation","/results","/simulation-results","/review","/simulation-review","/search","/progress","/saved-questions","/custom-papers","/pharmacology-review","/pharmacology-review/library","/resources","/notes","/leaderboard","/post-exam"]) {
    await page.goto(route,{waitUntil:"domcontentloaded"});
    await expect(page.locator('.app-topbar')).toHaveAttribute('data-shell-ready','true');
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.getByText('Application error',{exact:false})).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({path:`evidence/motion/journey/route-${info.project.name}-${route.replaceAll('/','_')}.png`});
  }
});

for (const reduce of [false, true]) test(`完整主流程${reduce ? " reduced motion" : "自然錄影"}：首頁、導覽、選科、10題、解析與結果`, async ({browser}, info) => {
  test.setTimeout(150_000);
  const device=info.project.use;
  const context=await browser.newContext({baseURL:"http://127.0.0.1:3004",viewport:device.viewport!,
    userAgent:device.userAgent,isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:1,
    serviceWorkers:"block",recordVideo:{dir:info.outputPath('journey'),size:device.viewport!}});
  const page=await context.newPage();
  const verifyMotion = async () => {
    if (!reduce) return;
    expect(await page.evaluate(() => document.getAnimations().flatMap(a =>
      (a.effect as KeyframeEffect).getKeyframes()).filter(f => f.transform && f.transform !== "none"))).toEqual([]);
  };
  try {
    if (reduce) await page.emulateMedia({reducedMotion:"reduce"});
    await home(page); await verifyMotion(); await page.waitForTimeout(700);
    await page.screenshot({path:`evidence/motion/journey/home-${info.project.name}${reduce ? "-reduced" : ""}.png`});
    await page.locator('.home-continue-button').click();
    await expect(page.getByRole('dialog',{name:'可繼續的測驗'})).toContainText('目前沒有進行中的測驗');
    await page.waitForTimeout(650); await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'開啟導覽',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'主要導覽'})).toBeVisible(); await verifyMotion();
    await page.waitForTimeout(650); await page.keyboard.press('Escape');
    const start=page.getByRole('link',{name:'散題練習',exact:true});
    await start.focus(); await page.waitForTimeout(350); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/start$/);
    const anatomy=page.locator('.quiz-setup-group button[aria-pressed]').filter({hasText:'解剖學'}).first();
    await anatomy.focus(); await page.keyboard.press('Space');
    await expect(anatomy).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'下一步',exact:true}).click();
    await expect(page.getByRole('heading',{name:'準備開始'})).toBeFocused(); await verifyMotion();
    const setup=page.getByRole('region',{name:'解剖學自由做題設定'});
    await setup.getByRole('button',{name:'調整設定'}).click();
    await expect(setup.getByRole('combobox',{name:'每輪題數'})).toBeVisible();
    await page.waitForTimeout(650);
    await setup.getByRole('button',{name:'收起設定'}).click();
    await setup.getByRole('button',{name:'開始 10 題',exact:true}).click();
    await expect(page).toHaveURL(/\/quiz\?/);
    const ids:string[]=[];
    for(let index=0;index<10;index++) {
      const card=page.locator('.study-question'); await expect(card).toBeVisible();
      const id=await card.getAttribute('data-question-id'); expect(id).toBeTruthy(); ids.push(id!);
      await card.locator('.study-choice').first().click();
      await page.getByRole('button',{name:'送出答案',exact:true}).click();
      await expect(page.locator('.quiz-answer-status')).toBeVisible(); await verifyMotion();
      if(index===0) {
        const explain=page.getByRole('button',{name:'陽明',exact:true});
        await explain.scrollIntoViewIfNeeded(); await explain.focus();
        const before=await explain.boundingBox(); await page.keyboard.press('Enter');
        await expect(page.getByRole('region',{name:'陽明詳解'})).toContainText('本機互動驗收');
        const after=await explain.boundingBox(); expect(Math.abs(after!.y-before!.y)).toBeLessThan(3);
        await page.waitForTimeout(650); await page.keyboard.press('Enter');
        await expect(explain).toBeFocused();
      }
      await page.waitForTimeout(index===0?450:150);
      await page.getByRole('button',{name:index===9?'查看結果':'下一題',exact:true}).filter({visible:true}).first().click();
      if(index<9) await expect(card).not.toHaveAttribute('data-question-id',id!);
    }
    await expect(page).toHaveURL(/\/results\?/);
    await expect(page.locator('.study-result-summary')).toContainText('共 10 題'); await verifyMotion();
    const filters=page.getByRole('group',{name:'回顧題目篩選'});
    await filters.getByRole('button',{name:/^全部/}).click();
    await expect(page.locator('.study-result-list > details')).toHaveCount(10);
    const summary=page.locator('.study-result-list > details > summary').first();
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.study-result-list > details').first()).toHaveAttribute('open','');
    await page.waitForTimeout(700);
    await page.screenshot({path:`evidence/motion/journey/results-${info.project.name}${reduce ? "-reduced" : ""}.png`});
    await page.keyboard.press('Enter');
    await expect(page.locator('.study-result-list > details').first()).not.toHaveAttribute('open','');
    await noOverflow(page);
    expect(new Set(ids).size).toBe(10);
  } finally {
    const video=page.video(); await context.close();
    await video?.saveAs(`evidence/motion/journey/journey-${info.project.name}${reduce ? "-reduced" : ""}.webm`);
  }
});
