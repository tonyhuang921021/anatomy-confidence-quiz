import { expect, test, type Page } from '@playwright/test';

async function openSearch(page:Page) {
  await page.route('**/*', async route=> {
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.abort();
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}});
    return route.continue();
  });
  await page.goto('/search?query=MOEX-113', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.search-result-card')).toHaveCount(30);
  await expect(page.getByRole('button',{name:'下一頁',exact:true})).toBeEnabled();
}

// A reproducible pre-fix run uses the actual production preview, without changing the site.
test('mouse pagination returns to the new results and carries focus', async({page},info)=> {
  await openSearch(page);
  const record=page.locator('.search-result-card').filter({hasText:/MOEX-113\d+-\d+-Q092/}).first();
  await expect(record).toBeVisible();
  const expand = record.locator('button[aria-controls^="search-result-details-"]');
  await expect(async () => {
    if (await expand.getAttribute('aria-expanded') !== 'true') await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true', { timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await record.getByRole('button',{name:'顯示答案與詳解',exact:true}).click();
  const next=page.getByRole('button',{name:'下一頁',exact:true});
  await next.scrollIntoViewIfNeeded();
  const historyLength=await page.evaluate(()=>history.length);
  await next.click();
  await expect(page.locator('.search-result-card').first()).toContainText('Q070');
  if(process.env.SEARCH_PAGINATION_BASELINE==='1') {
    expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(2000);
    await expect(next).toBeFocused();
    const fs=await import('node:fs/promises');
    await fs.writeFile(`reports/search-pagination/before/${info.project.name}-position.json`,JSON.stringify(await page.evaluate(()=>({scrollY,activeText:document.activeElement?.textContent,firstResult:document.querySelector('.search-result-card')?.textContent,historyLength:history.length})),null,2));
    await page.screenshot({path:`reports/search-pagination/before/${info.project.name}-page2-bottom.png`,fullPage:false});
    return;
  }
  const heading=page.getByRole('heading',{name:/搜尋結果.*第 2/});
  await expect(heading).toBeFocused();
  await expect.poll(()=>heading.evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(64);
  expect(await heading.evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(180);
  expect(await page.evaluate(()=>history.length)).toBe(historyLength);
  await page.screenshot({path:`reports/search-pagination/${info.project.name}-page2-start.png`,fullPage:false});
  await page.getByRole('button',{name:'上一頁',exact:true}).click();
  await expect(page.getByRole('heading',{name:/搜尋結果.*第 1/})).toBeFocused();
  await expect(page.locator('.search-result-card').first()).toContainText('Q100');
  expect(await page.evaluate(()=>history.length)).toBe(historyLength);
});

test('keyboard paging, disclosure rerenders and browser Back preserve reading intent', async({page},info)=> {
  test.skip(process.env.SEARCH_PAGINATION_BASELINE==='1','Baseline capture only');
  const historyKey='anatomy-confidence-completed-sessions:guest';
  const history=JSON.stringify([{id:'pagination-preserved-history',subject:'醫學（一）',startedAt:'2026-10-01T00:00:00Z',completedAt:'2026-10-01T01:00:00Z',settings:{mode:'simulation',subjectFilter:'醫學（一）',questionCount:1,selectedPaperKey:'115090-1301'},questionOrder:['MOEX-115090-1301-Q001'],attempts:[{questionId:'MOEX-115090-1301-Q001',selectedAnswer:'A',correctAnswer:'C',isCorrect:false,confidence:3,answeredAt:'2026-10-01T00:01:00Z'}]}]);
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:historyKey,value:history});
  await page.addInitScript(()=> {
    const original=HTMLElement.prototype.focus;
    (window as any).resultFocusCalls=0;
    const scroll=window.scrollTo.bind(window);
    (window as any).scrollEvents=[];
    window.scrollTo=(...args:any[]) => {
      const h=document.getElementById('question-search-results-heading');
      (window as any).scrollEvents.push({kind:'call',args,y:scrollY,top:h?.getBoundingClientRect().top,time:performance.now()});
      return (scroll as any)(...args);
    };
    document.addEventListener('scroll',()=>{
      const h=document.getElementById('question-search-results-heading');
      (window as any).scrollEvents.push({kind:'event',y:scrollY,top:h?.getBoundingClientRect().top,time:performance.now()});
    },{passive:true});
    HTMLElement.prototype.focus=function(options?:FocusOptions) {
      if(this.id==='question-search-results-heading')(window as any).resultFocusCalls++;
      return original.call(this,options);
    };
  });
  await openSearch(page);
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  const record=page.locator('.search-result-card').filter({hasText:/MOEX-113\d+-\d+-Q092/}).first();
  const expand = record.locator('button[aria-controls^="search-result-details-"]');
  await expect(async () => {
    if (await expand.getAttribute('aria-expanded') !== 'true') await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true', { timeout: 2000 });
  }).toPass({ timeout: 15000 });
  const reveal=record.getByRole('button',{name:'顯示答案與詳解',exact:true});
  await reveal.scrollIntoViewIfNeeded();
  const beforeDisclosure=await page.evaluate(()=>scrollY);
  await reveal.click();
  await expect(record.getByText('詳解',{exact:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(200);
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  // A selection rerenders the search component while the reader is below the result start.
  await record.getByRole('button',{name:'選入練習',exact:true}).click();
  await expect(record.getByRole('button',{name:'已選入練習',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  // Complete a real local image request below the current card, without changing its text or data.
  await record.evaluate(async element=> {
    const image=new Image();image.alt='pagination-image-load-probe';image.style.maxWidth='100%';image.style.height='auto';
    const loaded=new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('local probe image failed'));});
    image.src='/question-media/moex-98-99/MOEX-098020-1101-Q086.webp';element.append(image);await loaded;
  });
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(200);
  const next=page.getByRole('button',{name:'下一頁',exact:true});
  await next.focus();await page.keyboard.press('Enter');
  const page2=page.getByRole('heading',{name:/搜尋結果.*第 2/});
  await expect(page2).toBeFocused();
  try {
    await expect.poll(() => page2.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThan(100);
  } catch (error) {
    const events = await page.evaluate(()=>(window as any).scrollEvents); console.log('SCROLL_DIAGNOSTIC', JSON.stringify({ calls: events.filter((e:any)=>e.kind==='call'), tail: events.slice(-20) }));
    throw error;
  }
  // Tab traversal is recorded as a separate limitation: WebKit's native
  // full-keyboard-access preference is not changed by this test.
  await page.getByRole('button',{name:'上一頁',exact:true}).focus();await page.keyboard.press('Space');
  await expect(page.getByRole('heading',{name:/搜尋結果.*第 1/})).toBeFocused();
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(2);
  await expect(record.getByRole('button',{name:'已選入練習',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(record.locator('button[aria-controls^="search-result-details-"]')).toHaveAttribute('aria-expanded','true');
  await page.evaluate(()=>window.history.pushState(null,'','/search?query=MOEX-112'));
  await expect(page.locator('.search-result-card').first()).toContainText('MOEX-112');
  await page.goBack();
  await expect(page.locator('.search-result-card').first()).toContainText('MOEX-113');
  await expect(page.getByRole('heading',{name:/搜尋結果.*第 1/})).toBeVisible();
  await expect(record.locator('button[aria-controls^="search-result-details-"]')).toHaveAttribute('aria-expanded','true');
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(2);
  expect(await page.evaluate(key=>localStorage.getItem(key),historyKey)).toBe(history);
  const fs=await import('node:fs/promises');
  await fs.writeFile(`reports/search-pagination/${info.project.name}-reading-evidence.json`,JSON.stringify({beforeDisclosure,finalFocusCalls:2,selectionPreserved:true,disclosurePreserved:true,browserBackPreserved:true,historicalAnswersUnchanged:true},null,2));
});

test('desktop state and Back independently of scroll position', async({page},info)=> {
  test.skip(process.env.SEARCH_PAGINATION_BASELINE==='1','Baseline capture only');
  const historyKey='anatomy-confidence-completed-sessions:guest';
  const history=JSON.stringify([{id:'pagination-preserved-history',subject:'醫學（一）',startedAt:'2026-10-01T00:00:00Z',completedAt:'2026-10-01T01:00:00Z',settings:{mode:'simulation',subjectFilter:'醫學（一）',questionCount:1,selectedPaperKey:'115090-1301'},questionOrder:['MOEX-115090-1301-Q001'],attempts:[{questionId:'MOEX-115090-1301-Q001',selectedAnswer:'A',correctAnswer:'C',isCorrect:false,confidence:3,answeredAt:'2026-10-01T00:01:00Z'}]}]);
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:historyKey,value:history});
  await page.addInitScript(()=> {
    const original=HTMLElement.prototype.focus;
    (window as any).resultFocusCalls=0;
    const scroll=window.scrollTo.bind(window);
    (window as any).scrollEvents=[];
    window.scrollTo=(...args:any[]) => {
      const h=document.getElementById('question-search-results-heading');
      (window as any).scrollEvents.push({kind:'call',args,y:scrollY,top:h?.getBoundingClientRect().top,time:performance.now()});
      return (scroll as any)(...args);
    };
    document.addEventListener('scroll',()=>{
      const h=document.getElementById('question-search-results-heading');
      (window as any).scrollEvents.push({kind:'event',y:scrollY,top:h?.getBoundingClientRect().top,time:performance.now()});
    },{passive:true});
    HTMLElement.prototype.focus=function(options?:FocusOptions) {
      if(this.id==='question-search-results-heading')(window as any).resultFocusCalls++;
      return original.call(this,options);
    };
  });
  await openSearch(page);
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  const record=page.locator('.search-result-card').filter({hasText:/MOEX-113\d+-\d+-Q092/}).first();
  const expand = record.locator('button[aria-controls^="search-result-details-"]');
  await expect(async () => {
    if (await expand.getAttribute('aria-expanded') !== 'true') await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true', { timeout: 2000 });
  }).toPass({ timeout: 15000 });
  const reveal=record.getByRole('button',{name:'顯示答案與詳解',exact:true});
  await reveal.scrollIntoViewIfNeeded();
  const beforeDisclosure=await page.evaluate(()=>scrollY);
  await reveal.click();
  await expect(record.getByText('詳解',{exact:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(200);
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  // A selection rerenders the search component while the reader is below the result start.
  await record.getByRole('button',{name:'選入練習',exact:true}).click();
  await expect(record.getByRole('button',{name:'已選入練習',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  // Complete a real local image request below the current card, without changing its text or data.
  await record.evaluate(async element=> {
    const image=new Image();image.alt='pagination-image-load-probe';image.style.maxWidth='100%';image.style.height='auto';
    const loaded=new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('local probe image failed'));});
    image.src='/question-media/moex-98-99/MOEX-098020-1101-Q086.webp';element.append(image);await loaded;
  });
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(0);
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(200);
  const next=page.getByRole('button',{name:'下一頁',exact:true});
  await next.focus();await page.keyboard.press('Enter');
  const page2=page.getByRole('heading',{name:/搜尋結果.*第 2/});
  await expect(page2).toBeFocused();
  // Scroll-position failure is separately retained; this case checks only state and Back.
  // Tab traversal is recorded as a separate limitation: WebKit's native
  // full-keyboard-access preference is not changed by this test.
  await page.getByRole('button',{name:'上一頁',exact:true}).focus();await page.keyboard.press('Space');
  await expect(page.getByRole('heading',{name:/搜尋結果.*第 1/})).toBeFocused();
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(2);
  await expect(record.getByRole('button',{name:'已選入練習',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(record.locator('button[aria-controls^="search-result-details-"]')).toHaveAttribute('aria-expanded','true');
  await page.evaluate(()=>window.history.pushState(null,'','/search?query=MOEX-112'));
  await expect(page.locator('.search-result-card').first()).toContainText('MOEX-112');
  await page.goBack();
  await expect(page.locator('.search-result-card').first()).toContainText('MOEX-113');
  await expect(page.getByRole('heading',{name:/搜尋結果.*第 1/})).toBeVisible();
  await expect(record.locator('button[aria-controls^="search-result-details-"]')).toHaveAttribute('aria-expanded','true');
  expect(await page.evaluate(()=>(window as any).resultFocusCalls)).toBe(2);
  expect(await page.evaluate(key=>localStorage.getItem(key),historyKey)).toBe(history);
  const fs=await import('node:fs/promises');
  await fs.writeFile(`reports/search-pagination/${info.project.name}-reading-evidence.json`,JSON.stringify({beforeDisclosure,finalFocusCalls:2,selectionPreserved:true,disclosurePreserved:true,browserBackPreserved:true,historicalAnswersUnchanged:true},null,2));
});

// The override is scoped to search; navigating home restores the global setting.
test('home release note and search-only scroll behavior', async ({page}) => {
  await openSearch(page);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.getByText('搜尋結果換頁更順手', {exact:true}).first()).toBeVisible();
  await expect(page.locator('summary.home-study-update time')).toHaveText('10/29');
  await page.locator('summary.home-study-update').click();
  await expect(page.locator('.home-release-history li').first().locator('time')).toHaveAttribute('datetime', '2026-10-29');
  await expect(page.locator('.home-release-history').getByText('按上一頁或下一頁後，畫面會回到搜尋結果開頭，方便繼續閱讀。', {exact:true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth');
});
