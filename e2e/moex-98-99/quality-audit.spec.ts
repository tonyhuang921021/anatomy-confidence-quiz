import { expect, test } from '@playwright/test';
import payload from '../../data/sources/moex_98_99_official_questions.json';
import revisions from '../../data/sources/moex_98_99_verified_revisions.json';

// Only the newly repaired source representations; first-pass menu/history flows are not repeated.
test('source-reviewed text, notation and table render without mobile overflow', async ({ page }, info) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok:true, stats:[], overrides:{}, count:0, cards:[], reactions:[] } });
    return route.continue();
  });
  await page.goto('/simulation');
  await expect(page.locator('.app-topbar')).toHaveAttribute('data-shell-ready', 'true');
  for (const revision of revisions.revisions.filter(r=>!process.env.MOEX_QA_QUESTION_ID || r.id===process.env.MOEX_QA_QUESTION_ID)) {
    const question = payload.questions.find(q=>q.id===revision.id)!;
    const id = `source-qa-${question.id}`;
    await page.evaluate(({ question, id }) => {
      localStorage.setItem('anatomy-confidence-active-user-id', 'guest');
      localStorage.setItem('anatomy-confidence-current-session:guest', JSON.stringify({
        id, subject: question.subject, startedAt: new Date().toISOString(),
        settings: { mode:'random', questionCount:1, subjectFilter:question.subject, feedbackMode:'full', stopAfterReview:true, enableConfidenceCalibration:false },
        generatedQuestions:[question], questionOrder:[question.id], currentQuestionIndex:0, isReviewingAnswer:false, attempts:[]
      }));
    }, { question, id });
    await page.goto(`/quiz?resume=1&sessionId=${id}`);
    const card = page.locator(`[data-question-id="${question.id}"]`);
    await expect(card).toBeVisible();
    for (const [key,value] of Object.entries(question.options)) {
      const button = card.getByRole('button').filter({has: page.locator('span', {hasText:new RegExp(`^${key}$`)})});
      // Visible option text can split chemical subscripts into DOM nodes; compare semantic content without whitespace.
      const raw = await button.first().textContent();
      expect(raw?.replace(/\s/g,'')).toContain(value.replace(/\s/g,''));
    }
    const canonicalStem = question.stem.replace(/\s/g,'');
    const cardText = (await card.textContent())!.replace(/\s/g,'');
    expect(cardText).toContain(canonicalStem);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if (question.id==='MOEX-099010-2101-Q046') {
      expect(question.stem).not.toContain('326');
      expect(question.stem).not.toContain('受質濃度（substrate concentration）');
    }
    if (revision.showOriginal) {
      const image = card.locator('img').first();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
    }
    if (question.id==='MOEX-099010-1101-Q083' || question.id==='MOEX-099010-2101-Q046') {
      await page.screenshot({ path:`reports/moex-98-99/quality-audit/${info.project.name}-${question.id}.png`, fullPage:true });
    }
  }
});
