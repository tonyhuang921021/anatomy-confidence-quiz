import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const expenses=JSON.parse(fs.readFileSync(new URL('../lib/sponsorship/expenses.json',import.meta.url),'utf8'));
const page=fs.readFileSync(new URL('../components/SponsorshipPage.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../app/sponsorship/sponsorship.css',import.meta.url),'utf8');
test('user-confirmed invoice has consistent paid disclosure without inventing receipt',()=>{
 const june=expenses.records.find(r=>r.vendor==='Supabase'&&r.date.startsWith('2026-06'));
 assert.equal(june.status,'paid_user_confirmed');
 assert.match(june.detail,/站長已確認付款，納入已付合計/);
 assert.match(june.detail,/原始發票/);
 assert.doesNotMatch(june.detail,/未核實|不計入/);
 assert.equal(expenses.paidTotal,Math.round(expenses.records.reduce((sum, r) => sum + r.amount, 0) * 100) / 100);
});
test('amount-only release omits receipt media, downloads and dialogs',()=>{
 assert.doesNotMatch(page, /receipt-button|receipt-image|<dialog|<img|\/sponsorship\/receipts/);
 assert.match(page,/不公開憑證圖片或檔案/);
 assert.doesNotMatch(css,/receipt-image|receipt-button|receipt-content/);
});
test('currency prefix does not shrink or wrap and preview gets bottom clearance',()=>{
 assert.match(css,/input-wrap>span\{white-space:nowrap;flex:0 0 auto/);
 assert.match(css,/input-wrap>input\{min-width:0/);
 assert.match(css,/padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom/);
});

test('October Vercel receipt is unique and totals retain dated reference FX',()=>{
 const oct=expenses.records.filter(r=>r.vendor==='Vercel' && r.period==='2026-10-16 – 2026-11-15');
 assert.equal(oct.length,1);assert.equal(oct[0].amount,20);assert.equal(oct[0].date,'2026-10-16');
 assert.equal(expenses.paidTotal,251.37);assert.equal(expenses.records.length,10);
 assert.equal(expenses.conversion.rate,32.43);assert.equal(expenses.conversion.quotedAt,'2026-10-16 15:33 Asia/Taipei');
 assert.equal(Math.round(expenses.paidTotal*expenses.conversion.rate*100)/100,8151.93);
 assert.match(page,/records.filter/);assert.doesNotMatch(page,/尚未取得 10 月 Vercel/);
});
