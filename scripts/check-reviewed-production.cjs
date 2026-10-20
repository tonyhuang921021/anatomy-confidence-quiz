// Isolated guest browsers; no API mocks or injected quiz/history records.
const { chromium, webkit, devices, expect } = require('@playwright/test');
const fs = require('node:fs');
const base = process.argv[2];
if (!base) throw new Error('Pass the deployment URL to verify');
const report = {base, checkedAt:new Date().toISOString(), fixtureAPIs:false, injectedRecords:false, results:[]};
(async()=>{
 for (const [name, engine, device] of [['desktop',chromium,{viewport:{width:1280,height:900}}],['mobile',webkit,devices['iPhone 13']]]) {
  const browser=await engine.launch();const context=await browser.newContext({...device,baseURL:base});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto('/');
   await expect(page.getByRole('heading',{name:'國考刷題',exact:true})).toBeVisible();
   await expect(page.getByText('1,400 題圖文詳解，一起補齊',{exact:true})).toBeVisible();
   await page.getByRole('link',{name:'題目搜尋',exact:true}).first().click();
   for (const id of ['MOEX-112100-2301-Q096','MOEX-113020-1301-Q001','MOEX-113090-1301-Q006','MOEX-114020-1301-Q077','moex-med1-supplement-v5-115020-1301-095']) {
    await page.getByRole('textbox',{name:'想找哪一題？'}).fill(id);
    const card=page.locator('article.search-result-card');await expect(card).toHaveCount(1);await expect(card).toContainText(id);
    await card.locator('button[aria-controls^="search-result-details-"]').click();
    await card.getByRole('button',{name:'顯示答案與詳解',exact:true}).click();
    const reader=card.locator('.reviewed-explanation');await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
    await reader.getByRole('button',{name:'詳解',exact:true}).click();
    await expect(reader.locator('[data-reader-mode="detailed"]')).toBeVisible();
    for(const disclosure of await reader.locator('details').filter({has:page.locator('img')}).all()) {
     if(await disclosure.getAttribute('open')===null) await disclosure.locator(':scope > summary').click();
    }
    for(const img of await reader.locator('img').all()) {
     await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
     const b=await img.boundingBox();expect(b.height).toBeLessThanOrEqual(name==='mobile'?321:401);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await reader.scrollIntoViewIfNeeded();await page.screenshot({path:`evidence/explanations/production-${name}-${id}.png`});
    await card.getByRole('button',{name:'更多',exact:true}).click();
    await expect(card.getByRole('button',{name:/重新替換詳解|用 AI 補詳解/})).toHaveCount(0);
    await card.getByRole('button',{name:'更多',exact:true}).click();
    await card.getByRole('button',{name:'選入練習',exact:true}).click();
   }
   await page.getByRole('button',{name:'開始私人練習',exact:true}).click();
   await expect(page).toHaveURL(/\/quiz\?/);
   for(let i=0;i<5;i++) {
    const q=page.getByRole('group',{name:'作答題目',exact:true});await expect(q).toBeVisible();
    await q.locator('.study-choice').first().click();await page.getByRole('button',{name:'送出答案',exact:true}).click();
    await expect(page.locator('.quiz-answer-status')).toBeVisible();
    await expect(page.locator('.reviewed-explanation [data-reader-mode="short"]')).toBeVisible();
    await page.getByRole('button',{name:i===4?'查看結果':'下一題',exact:true}).filter({visible:true}).first().click();
   }
   await expect(page).toHaveURL(/\/results\?/);await expect(page.locator('.study-result-summary')).toContainText('共 5 題');
   const readHistory=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('anatomy-confidence-completed-sessions:')).map(k=>[k,localStorage.getItem(k)])));
   const before=await readHistory();expect(Object.keys(before).length).toBeGreaterThan(0);
   await page.reload();await expect(page.locator('.study-result-summary')).toContainText('共 5 題');expect(await readHistory()).toEqual(before);
   expect(errors).toEqual([]);report.results.push({name,ok:true,questions:5,pageErrors:errors});
  } finally {await context.close();await browser.close();}
 }
 fs.writeFileSync('evidence/explanations/production-complete-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
