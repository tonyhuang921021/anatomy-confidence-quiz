import {test,expect} from '@playwright/test';
import payload from '../../data/sources/moex_98_99_official_questions.json';

test('all eight canonical papers start, corrected tables and final credit rules survive submission',async({page},info)=>{
 test.setTimeout(180000);
 page.setDefaultTimeout(15000);
 const origin=new URL(process.env.MOEX_VERIFY_ORIGIN||'http://127.0.0.1:3098');
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname!==origin.hostname)return route.abort();
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}});
  return route.continue();
 });
 const checks:Record<string,Array<[number,string]>>={
  '098020-1101':[[2,'B'],[86,'B']],
  '098140-1101':[[95,'D']],
  '098140-2101':[[16,'D'],[29,'B'],[70,'D']],
  '099010-1101':[[40,'C']],
 };
 for(const paper of payload.papers){
  await page.goto('/simulation');
  await expect(page.locator('.app-topbar')).toHaveAttribute('data-shell-ready','true');
  await page.getByRole('button',{name:paper.subject}).click();
  await page.locator('#simulation-paper').selectOption(paper.key);
  await page.getByText('調整考卷來源與作答方式',{exact:true}).click();
  await page.locator('#simulation-feedback-mode').selectOption('full');
  console.log('Checking canonical paper',paper.key);
  await page.getByRole('button',{name:'開始 100 題模擬考',exact:true}).click();
  await expect(page.locator(`[data-question-id="MOEX-${paper.key}-Q001"]`)).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-confidence-current-session:guest')||'null'));
  expect(stored.questionOrder).toHaveLength(100);
  expect(new Set(stored.questionOrder).size).toBe(100);
  expect(stored.generatedQuestions?.length||0).toBe(0);
  for(const [number,answer] of checks[paper.key]||[]){
   const q=payload.questions.find(q=>q.id===`MOEX-${paper.key}-Q${String(number).padStart(3,'0')}`)!;
   await page.evaluate(({id,index})=>{const k='anatomy-confidence-current-session:guest';const s=JSON.parse(localStorage.getItem(k)!);s.currentQuestionIndex=index;s.isReviewingAnswer=false;s.attempts=[];localStorage.setItem(k,JSON.stringify(s));},{id:q.id,index:number-1});
   await page.goto(`/quiz?resume=1&sessionId=${stored.id}`);
   const card=page.locator(`[data-question-id="${q.id}"]`);await expect(card).toBeVisible();
   const text=(await card.innerText()).replace(/\s/g,'');expect(text).toContain(q.stem.replace(/\s/g,''));
   if(q.stemImage){const img=card.locator('img').first();await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await card.getByRole('button').filter({has:page.locator('span',{hasText:new RegExp(`^${answer}$`)})}).first().click();
   await page.getByRole('button',{name:'送出答案',exact:true}).click();
   const attempt=await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-confidence-current-session:guest')!).attempts.at(-1));
   expect(attempt.questionId).toBe(q.id);expect(attempt.selectedAnswer).toBe(answer);expect(attempt.isCorrect).toBe(true);
   if(number===86||number===95)await card.screenshot({path:`reports/moex-98-99/${info.project.name}-release-${q.id}.png`});
  }
 }
});
