import {test,expect} from '@playwright/test';
import payload from '../../data/sources/moex_98_99_official_questions.json';
import review from '../../data/sources/moex_98_99_classification_review.json';
import fs from 'node:fs';
async function localOnly(page:any){await page.route('**/*',async(route:any)=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,stats:[],points:[],overrides:{},count:0,cards:[],reactions:[]}});return route.continue();});}
const examples=[
 ['公共衛生學','公共衛生學－醫學史與公共衛生史','MOEX-098020-1101-Q100'],
 ['微生物免疫學','微生物免疫學－病原與宿主免疫逃脫','MOEX-099010-1101-Q055'],
 ['生物化學','生物化學－臨床生化檢驗與疾病標誌','MOEX-098020-2101-Q049']
];
test('three additive fine categories are reachable from progress practice and preserve real official scoring',async({page},info)=>{
 await localOnly(page);const evidence:any[]=[];
 for(const [subject,tag,id]of examples){
  await page.goto('/progress/practice?'+new URLSearchParams({subject,tag}));
  await expect(page.getByRole('heading',{level:1})).toContainText(tag.split('－')[1]);
  await page.getByRole('combobox',{name:'起始年份',exact:true}).selectOption('2009');
  await page.getByRole('combobox',{name:'結束年份',exact:true}).selectOption('2010');
  await expect(page.getByRole('button',{name:'開始 1 題',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'開始 1 題',exact:true}).click();
  const card=page.locator(`[data-question-id="${id}"]`);await expect(card).toBeVisible();await expect(card).toContainText(tag);
  const q=payload.questions.find(q=>q.id===id)!;
  await card.getByText('查看官方原題（含圖表）',{exact:true}).click();
  const image=card.locator('img').last();await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
  const answer=q.acceptedAnswers[0];await card.getByRole('button').filter({has:page.locator('span',{hasText:new RegExp(`^${answer}$`)})}).first().click();await page.getByRole('button',{name:'送出答案',exact:true}).click();
  const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-confidence-current-session:guest')!));expect(session.questionOrder).toEqual([id]);expect(session.attempts[0].isCorrect).toBe(true);expect(session.attempts[0].selectedAnswer).toBe(answer);
  await page.reload();await expect(card).toContainText(tag);expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-confidence-current-session:guest')!))).attempts[0].isCorrect).toBe(true);
  evidence.push({id,subject,tag,answer,accepted:q.acceptedAnswers,resume:true,sourceImage:true});
 }
 await page.screenshot({path:`reports/maintenance-20261025/classification/${info.project.name}-new-fine-topic-viewport.png`,fullPage:false});
 fs.writeFileSync(`reports/maintenance-20261025/classification/${info.project.name}-new-fine-topic-evidence.json`,JSON.stringify(evidence,null,2));
});
test('learning chapter keywords find legacy questions and search opens a playable private pool',async({page},info)=>{
 await localOnly(page);
 await page.goto('/search?query='+encodeURIComponent('腹壁與腹股溝'));
 const article=page.locator('article').filter({hasText:'MOEX-098020-1101-Q017'});await expect(article).toBeVisible();
 await article.getByRole('button',{name:'選入練習',exact:true}).click();
 await page.getByRole('button',{name:'開始私人練習',exact:true}).click();
 await expect(page).toHaveURL(/\/quiz/);
 const id='MOEX-098020-1101-Q017',card=page.locator(`[data-question-id="${id}"]`);await expect(card).toBeVisible();
 await expect(card).toContainText((review.questions as unknown as Record<string,[string,string]>)[id][1]);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-confidence-current-session:guest')!));expect(session.questionOrder).toEqual([id]);
 await page.screenshot({path:`reports/maintenance-20261025/classification/${info.project.name}-chapter-search-viewport.png`,fullPage:false});
});
