import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = path => fs.readFileSync(path, 'utf8');
const files = ['SponsorshipInformation', 'SponsorshipPage', 'SponsorshipSupportForm', 'SponsorshipDonorPreferences', 'SponsorshipDonorListPreview', 'SponsorshipPaymentUnavailable'];
test('public sponsorship surfaces contain approved copy with no test, pending or contract-date labels', () => {
  for (const name of files) assert.doesNotMatch(read(`components/${name}.tsx`), /測試|待核|待確認|2026.10.28|合約已簽署|TEST 付款/);
  for (const path of ['app/sponsorship/test/page.tsx','app/payment-return/page.tsx','app/payment-failure/page.tsx']) {
    const source=read(path); assert.match(source, /SponsorshipPaymentUnavailable/); assert.doesNotMatch(source, /SponsorshipTestPanel|測試|TEST/);
  }
});
function harness() {
 const states=[]; let cursor=0,tree;
 const hooks={useState(initial) {const i=cursor++; if(!(i in states)) states[i]=initial; return [states[i],v=>{states[i]=v;}];}};
 const filename=process.cwd()+'/components/SponsorshipSupportForm.tsx';
 const source=ts.transpileModule(read(filename),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const compiled=new Module(filename); compiled.paths=Module._nodeModulePaths(process.cwd()); const fallback=compiled.require.bind(compiled);
 compiled.require=name=> name==='react'?hooks:name==='@/lib/sponsorship/support-policy.mjs'?require('../lib/sponsorship/support-policy.mjs'):name==='@/components/SponsorshipDonorPreferences'?{SponsorshipDonorPreferences:'donor-settings'}:name==='next/link'?{__esModule:true,default:'a'}:fallback(name);
 compiled._compile(source,filename);
 const find=(predicate,node=tree)=> !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(c=>find(predicate,c)):[...(predicate(node)?[node]:[]),...(node.props?.children == null ? [] : find(predicate,node.props.children))];
 const render=()=>{cursor=0;tree=compiled.exports.SponsorshipSupportForm();}; render(); return {render,find};
}
test('terms consent defaults unchecked, is independent and repeated toggles never enable payment',()=>{
 const h=harness(); const checkbox=()=>h.find(n=>n.props?.id==='sponsorship-terms')[0]; const payment=()=>h.find(n=>n.props?.className==='checkout')[0];
 assert.equal(checkbox().props.checked,false); assert.equal(checkbox().props.required,true); assert.equal(payment().props.disabled,true);
 const donor=()=>h.find(n=>n.type==='donor-settings')[0]; const original={...donor().props};
 for(const checked of [true,false,true]) { checkbox().props.onChange({target:{checked}}); h.render(); assert.equal(checkbox().props.checked,checked); assert.equal(payment().props.disabled,true); assert.deepEqual(donor().props,original); }
 const link=h.find(n=>n.props?.href==='/sponsorship/terms')[0]; assert.equal(link.props.target,'_blank'); assert.match(link.props.rel,/noopener/);
 assert.equal(harness().find(n=>n.props?.id==='sponsorship-terms')[0].props.checked,false);
});
test('terms link points to real readable policy and does not require login',()=>{
 const source=read('app/sponsorship/terms/page.tsx'); assert.match(source,/<SponsorshipInformation expanded/); assert.doesNotMatch(source,/useAuth|fetch\(/);
});
test('existing official paper-card fix and release note are preserved',()=>{
 assert.match(read('components/QuizSetupPanel.tsx'),/<PastPaperCard/);
 assert.match(read('app/page.tsx'),/考卷續作卡片排版修正/);
 assert.match(read('components/PastPaperCard.tsx'),/本次已答/);
});

test('published copy uses formal policy language without preview or development narration',()=>{
 const info=read('components/SponsorshipInformation.tsx');
 const form=read('components/SponsorshipSupportForm.tsx');
 const page=read('components/SponsorshipPage.tsx');
 const donor=read('components/SponsorshipDonorPreferences.tsx');
 assert.doesNotMatch(info,/目前填寫|當前頁面|不會送出或儲存|重新整理後即清除/);
 assert.doesNotMatch(form,/填寫內容不會送出|操作預覽|設定預覽/);
 assert.doesNotMatch(page,/本版|此版|先列出|暫不提供|確認後再補入/);
 assert.doesNotMatch(donor,/設定預覽|你的顯示預覽|目前只在本頁預覽/);
 assert.match(form,/付款尚未開放/); assert.match(page,/付款尚未開放/); assert.match(info,/款項完全用於支持網站維護，展開可查看詳細說明。/);
});
