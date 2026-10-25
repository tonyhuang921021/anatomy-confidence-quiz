import payload from '../../data/sources/moex_98_99_official_questions.json';
import {test,expect} from '@playwright/test';
async function localOnly(page:any){await page.route('**/*',async(route:any)=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,stats:[],points:[],overrides:{},count:0,cards:[],reactions:[]}});return route.continue();});}
test('Taiwan calendar countdown and compact real update history support mouse, keyboard and back',async({page},info)=>{
 await localOnly(page);await page.clock.install({time:new Date('2026-10-25T17:00:00Z')});await page.goto('/');
 const countdown=page.getByLabel('醫師第一階段考試倒數');await expect(countdown).toContainText('倒數 82 天');await expect(countdown).toContainText('116/01/16');
 await countdown.screenshot({path:`reports/maintenance-20261025/${info.project.name}-countdown.png`});
 const disclosure=page.locator('.home-study-updates');const summary=disclosure.locator('summary');await expect(disclosure).not.toHaveAttribute('open','');const url=page.url();
 await summary.click();await expect(disclosure).toHaveAttribute('open','');await expect(disclosure.locator('li')).toHaveCount(8);await expect(disclosure).toContainText('1,400 題圖文詳解');await expect(disclosure).toContainText('115/10/25');expect(page.url()).toBe(url);
 await summary.press('Enter');await expect(disclosure).not.toHaveAttribute('open','');await summary.press('Space');await expect(disclosure).toHaveAttribute('open','');
 await disclosure.screenshot({path:`reports/maintenance-20261025/${info.project.name}-updates-open.png`});
 await summary.click();await summary.click();await expect(disclosure).toHaveAttribute('open','');
 await page.locator('main').getByRole('link',{name:'歷屆試題',exact:true}).click();await expect(page).toHaveURL(/simulation/);await page.goBack();await expect(page.locator('.home-study-updates')).toBeVisible();
 await page.clock.setSystemTime(new Date('2027-01-15T16:00:00Z'));await page.clock.fastForward(60001);await expect(countdown).toContainText('今天考試');
 await page.clock.setSystemTime(new Date('2027-01-16T16:00:00Z'));await page.clock.fastForward(60001);await expect(countdown).toContainText('日期待官方公告');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('paper and free-practice year labels are ROC while real filter values remain Gregorian',async({page},info)=>{
 await localOnly(page);await page.goto('/simulation');await expect(page.locator('.app-topbar')).toHaveAttribute('data-shell-ready','true');
 for(const subject of ['醫學（一）','醫學（二）']){await page.getByRole('button',{name:subject}).click();const labels=await page.locator('#simulation-paper option').allTextContents();expect(labels.filter(s=>s.includes('民國')).length).toBe(36);expect(labels.some(s=>/\b(?:19|20)\d{2}\b/.test(s))).toBe(false);}
 await page.locator('#simulation-paper').selectOption('098020-2101');await expect(page.locator('#simulation-paper')).toHaveValue('098020-2101');
 await page.goto('/start');await page.getByRole('button',{name:/^解剖學/}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'調整設定',exact:true}).click();
 const from=page.locator('#general-practice-year-from'),to=page.locator('#general-practice-year-to');await expect(from.locator('option[value="2009"]')).toHaveText('民國 98 年');await from.selectOption('2026');await expect(from).toHaveValue('2026');await expect(to).toHaveValue('2026');
 await page.getByRole('button',{name:'收起設定',exact:true}).click();await expect(page.getByText(/民國 115 年–民國 115 年/)).toBeVisible();await page.screenshot({path:`reports/maintenance-20261025/${info.project.name}-practice-years.png`,fullPage:true});
});


test('all 800 legacy IDs enter free practice and real answers survive results, saved questions and wrong review',async({page},info)=>{
 test.setTimeout(180000);await localOnly(page);await page.goto('/start');await page.getByRole('button',{name:/98、99 年舊制原卷/}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();
 await page.getByRole('button',{name:/^開始 10 題$/}).click();await expect(page.locator('[data-question-id]').first()).toBeVisible();
 const storageKey='anatomy-confidence-current-session:guest';let session=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),storageKey);
 expect(session.settings.strictCustomQuestionPool).toBe(true);expect(new Set(session.settings.customQuestionIds)).toEqual(new Set(payload.questions.map(q=>q.id)));expect(session.questionOrder).toHaveLength(10);
 const byId=new Map(payload.questions.map(q=>[q.id,q]));let wrongId='';
 for(let index=0;index<10;index++){
  const card=page.locator('[data-question-id]').first();const id=await card.getAttribute('data-question-id');const q=byId.get(id!)!;expect(q).toBeTruthy();await expect(card).toContainText('學科分類待核對');
  const wrong=Object.keys(q.options).find(a=>!q.acceptedAnswers.includes(a));const answer=!wrongId&&wrong?wrong:q.acceptedAnswers[0];const wrongNow=!wrongId&&Boolean(wrong);if(wrongNow)wrongId=q.id;
  await card.getByRole('button').filter({has:page.locator('span',{hasText:new RegExp(`^${answer}$`)})}).first().click();await page.getByRole('button',{name:'送出答案',exact:true}).click();
  session=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),storageKey);const attempt=session.attempts.find((a:any)=>a.questionId===q.id);expect(attempt.selectedAnswer).toBe(answer);expect(attempt.isCorrect).toBe(!wrongNow);
  if(wrongNow)await page.getByRole('button',{name:'儲存題目',exact:true}).click();
  await page.getByRole('button',{name:index===9?'查看結果':'下一題',exact:true}).and(page.locator('button:visible')).first().click();
 }
 expect(wrongId).not.toBe('');await expect(page).toHaveURL(/results/);const history=await page.evaluate(()=>localStorage.getItem('anatomy-confidence-completed-sessions:guest'));expect(history).toContain(wrongId);
 await page.goto('/saved-questions');await expect(page.locator('main')).toContainText(byId.get(wrongId)!.stem.slice(0,12));await page.reload();await expect(page.locator('main')).toContainText(byId.get(wrongId)!.stem.slice(0,12));
 await page.goto('/review');await expect(page.locator('main')).toContainText(byId.get(wrongId)!.stem.slice(0,12));expect(await page.evaluate(()=>localStorage.getItem('anatomy-confidence-completed-sessions:guest'))).toBe(history);
 await page.screenshot({path:`reports/maintenance-20261025/${info.project.name}-legacy-wrong-review.png`,fullPage:true});
});
