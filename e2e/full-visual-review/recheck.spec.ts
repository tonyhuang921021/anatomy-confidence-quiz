import {test,expect} from '@playwright/test';
import payload from '../../data/sources/moex_98_99_official_questions.json';
import fs from 'node:fs/promises';
const folder='reports/moex-98-99/full-visual-review-20261025/recheck';
test('capture actual imported question presentation for manual source comparison',async({page})=>{
 test.setTimeout(1800000);
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,stats:[],overrides:{},count:0,cards:[],reactions:[]}});return route.continue();});
 await fs.mkdir(folder+'/frontend',{recursive:true});await page.goto('/simulation');await expect(page.locator('.app-topbar')).toHaveAttribute('data-shell-ready','true');
 const questions=payload.questions.filter(q=>['MOEX-098020-1101-Q086','MOEX-098140-1101-Q095'].includes(q.id));
 for(const question of questions){
  const path=folder+'/frontend/'+question.id;
  try{await fs.access(path+'.json');continue;}catch{}
  const id='visual-'+question.id;
  await page.evaluate(({q,id})=>{localStorage.setItem('anatomy-confidence-active-user-id','guest');localStorage.setItem('anatomy-confidence-current-session:guest',JSON.stringify({id,subject:q.subject,startedAt:new Date().toISOString(),settings:{mode:'random',questionCount:1,subjectFilter:q.subject,feedbackMode:'full',stopAfterReview:true,enableConfidenceCalibration:false},generatedQuestions:[q],questionOrder:[q.id],currentQuestionIndex:0,isReviewingAnswer:false,attempts:[]}));},{q:question,id});
  await page.goto('/quiz?resume=1&sessionId='+id);const card=page.locator('[data-question-id="'+question.id+'"]');await expect(card).toBeVisible();
  for(const img of await card.locator('img:visible').all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);}
  const text=await card.innerText();await expect(card.locator('img').first()).toBeVisible();expect(text).not.toContain('陰性098');expect(text).not.toContain('基線人數');await card.screenshot({path:path+'.png'});await fs.writeFile(path+'.json',JSON.stringify({id:question.id,text,question,imageLoaded:true,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},null,2));
  if((questions.indexOf(question)+1)%25===0)console.log('Captured',questions.indexOf(question)+1,'frontend question presentations; NOT counted as manual visual review.');
 }
});
