import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync(new URL('../components/SponsorshipPage.tsx',import.meta.url),'utf8');
const form=fs.readFileSync(new URL('../components/SponsorshipSupportForm.tsx',import.meta.url),'utf8');
const info=fs.readFileSync(new URL('../components/SponsorshipInformation.tsx',import.meta.url),'utf8');
test('all seven review sections are guest-readable native accordions',()=>{
 for(const id of ['service','sponsorship','terms','privacy','refund','contact','operator']){
  assert.match(info,new RegExp(`<details id="${id}-information"`));
  assert.match(info,new RegExp(`id="${id}-information"`));
 }
 assert.doesNotMatch(info,/useSession|useAuth|fetch\(/);
});
test('free service, no extra rights and unresolved business decisions stay explicit',()=>{
 for(const phrase of ['刷題和複習維持免費','贊助不提供額外功能或會員權益','自願、無償支持','最低贊助金額為新台幣 100 元','tonyhuang921021@gmail.com','<strong>sinj</strong>','單純改變心意不另外提供退款']) assert.ok(info.includes(phrase),phrase);
 assert.doesNotMatch(info,/七日必退|一律不退款|保證入帳|一定全額/);
});
test('payment stays disabled and the confirmed NT$100 minimum is presented',()=>{
 assert.match(form,/className="checkout" disabled/);
 assert.doesNotMatch(form,/\/api\/sponsorship\/checkout|min="1"|max="100000"|step="1"/);
 assert.match(form,/每筆至少 NT\$ 100/);
});
test('dated history and signed contract replace stale assertions',()=>{
 assert.match(page,/截至 2026.10.17/);
 assert.doesNotMatch(form,/2026.10.28|合約已簽署/);
 assert.doesNotMatch(page,/目前未簽署報價|今日最新總成本/);
});

test('list and collapsed information lead to separate form; ledger is last and collapsed',()=>{
 assert.doesNotMatch(page, /className="stats"|支出摘要|歷史平台帳單 · 台幣估算|付款確認依據/);
 assert.doesNotMatch(page, /<SponsorshipDonorPreferences|className="checkout"|sponsorship-amount/);
 const list=page.indexOf('<SponsorshipDonorListPreview');
 const infoPosition=page.indexOf('<SponsorshipInformation');
 const cta=page.indexOf('href="/sponsorship/support"');
 const ledger=page.indexOf('<details className="ledger-accordion"');
 assert.ok(list < infoPosition && infoPosition < cta && cta < ledger);
 assert.match(info,/<details className="review-information information-accordion" id="information-title"/);
 assert.match(info,/expanded = false/);
 assert.match(info,/information-summary-note">所有贊助皆為自願、無償支持，是否贊助由你自由決定。刷題與複習維持免費，不會因贊助與否而增加或減少任何功能。款項完全用於支持網站維護，展開可查看詳細說明。/);
 assert.match(page,/<details className="ledger-accordion" id="expense-information">/);
 assert.match(form,/href="\/sponsorship"/);
 assert.doesNotMatch(form,/fetch\(|localStorage|sessionStorage/);
});
