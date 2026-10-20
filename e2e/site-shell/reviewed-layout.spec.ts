import { test, expect } from '@playwright/test';
test.use({serviceWorkers:'block'});
test('詳解不重複原題、圖片有上限與放大入口，必要圖示與來源保留',async({page},info)=>{
 test.setTimeout(90000);
 await page.route('https://e2e.invalid/**',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}}));
 for(const id of ['MOEX-112100-2301-Q096','MOEX-112100-1301-Q003','MOEX-112100-1301-Q062','MOEX-112100-2301-Q076']){
  await page.goto('/search?query='+id);
  const card=page.locator('article.search-result-card');await expect(card).toHaveCount(1);
  await card.locator('button[aria-controls^="search-result-details-"]').click();await card.getByRole('button',{name:'顯示答案與詳解'}).click();
  const reader=card.locator('.reviewed-explanation');await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();await reader.getByRole('button',{name:'詳解',exact:true}).click();
  await expect(reader.locator('ol[type="A"]')).toHaveCount(0);await expect(reader.locator('.reviewed-official-answer')).toHaveCount(1);
  if(id.endsWith('1301-Q062'))await expect(reader.locator('img')).toHaveCount(3);
  for(const img of await reader.locator('img').all()){
   await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate((x:HTMLImageElement)=>x.complete&&x.naturalWidth>0)).toBe(true);
   const box=await img.boundingBox();expect(box!.height).toBeLessThanOrEqual(info.project.name==='webkit-mobile'?320.5:400.5);
   expect(await img.evaluate((el:HTMLImageElement)=>Math.abs(el.getBoundingClientRect().width/el.getBoundingClientRect().height-el.naturalWidth/el.naturalHeight))).toBeLessThan(.02);
  }
  expect(await reader.locator('.reviewed-image-link').count()).toBe(await reader.locator('img').count());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await reader.scrollIntoViewIfNeeded();await page.screenshot({path:`evidence/explanations/layout-${info.project.name}-${id}.png`,fullPage:true});
 }
});
