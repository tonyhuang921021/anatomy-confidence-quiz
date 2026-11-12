import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MIN_SUPPORT_AMOUNT, parseSupportAmount } from '../lib/sponsorship/support-policy.mjs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('confirmed minimum rejects lower values without inventing a site maximum', () => {
  assert.equal(MIN_SUPPORT_AMOUNT, 100);
  for (const value of ['100', '101', '300', '750', '100001']) assert.equal(parseSupportAmount(value), Number(value));
  for (const value of ['0', '1', '99', '-100', '100.5', '1e2', '+100', '', ' 100 ', 'Infinity', 'NaN', '９９', '9007199254740992', 100, null]) assert.equal(parseSupportAmount(value), null);
});
test('confirmed public identity and contact replace outdated pending fields', () => {
  const info = read('components/SponsorshipInformation.tsx');
  assert.match(info, /公開營運名稱：<strong>sinj<\/strong>/);
  assert.match(info, /href="mailto:tonyhuang921021@gmail.com"/);
  assert.doesNotMatch(info, /公開客服信箱：待確認|對外營運／收款名稱：待確認|正式最低、最高金額及金額步進尚未定案/);
  assert.match(info, /金流登記及信用卡帳單顯示名稱會另行核對/);
});
test('refund proposals do not silently promise unapproved terms or shift card fees', () => {
  const info = read('components/SponsorshipInformation.tsx');
  const form = read('components/SponsorshipSupportForm.tsx');
  assert.match(info, /退款期限、回覆時間及實際費用仍待確認/);
  assert.doesNotMatch(info, /7 天|七天|3 個工作天|三個工作天|退款一律|扣除.*3%|網站負擔/);
  assert.match(form, /3%／4% 是收款費率/);
  assert.match(form, /額外費用及負擔方式尚未定案/);
});
test('preview validates approved minimum locally without storing or sending data', () => {
  const form = read('components/SponsorshipSupportForm.tsx');
  assert.match(form, /parseSupportAmount\(previewAmount\)/);
  assert.match(form, /className="checkout" disabled/);
  assert.doesNotMatch(form, /fetch\(|localStorage|sessionStorage|\.rpc\(|\/api\/sponsorship/);
});

test('UI-review release blocks every sponsorship API before inherited project configuration', async () => {
  const { SPONSORSHIP_REVIEW_ONLY, sponsorshipReviewResponse } = await import('../lib/sponsorship/review-only.mjs');
  assert.equal(SPONSORSHIP_REVIEW_ONLY, true);
  const response = sponsorshipReviewResponse();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'PREVIEW_CHECKOUT_DISABLED');
  for (const route of ['checkout', 'donor-consent', 'reconcile', 'status', 'test-config', 'test-session']) {
    const source = read(`app/api/sponsorship/${route}/route.ts`);
    const gate = source.indexOf('if (SPONSORSHIP_REVIEW_ONLY) return sponsorshipReviewResponse();');
    const dispatch = source.lastIndexOf('return handle');
    assert.ok(gate > 0 && gate < dispatch, route);
  }
  const ignores = read('.vercelignore');
  for (const name of ['.env*', '.codex', 'docs', 'scripts', 'supabase']) assert.ok(ignores.split('\n').includes(name));
});

test('owner requested amounts only: no receipt images, PDF links or uploaded files', () => {
  const page = read('components/SponsorshipPage.tsx');
  assert.doesNotMatch(page, /<dialog|<img|\/sponsorship\/receipts|receipt-button/);
  assert.match(page, /歷史支出金額/);
  const ledger = JSON.parse(read('lib/sponsorship/expenses.json'));
  assert.equal(ledger.records.length, 10);
  for (const row of ledger.records) {
    assert.equal('file' in row, false);
    assert.equal('images' in row, false);
  }
  assert.equal(fs.existsSync(new URL('../public/sponsorship/receipts', import.meta.url)), false);
});
