const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), assert=require('node:assert/strict');
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
function load(file, mocks){const src=fs.readFileSync(file,'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:n=>{if(n in mocks)return mocks[n];return require(n)},URL});return m.exports;}
const image=load('lib/reviewedImageSource.ts',{});
const fig=load('lib/verifiedExplanationFigures.ts',{'@/lib/reviewedImageSource':image});
const good={asset:'/reviewed-explanations/assets/a.png',alt:'清楚圖說',caption:'示意說明',sourceUrl:'https://example.org/source',attribution:'作者',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'};
assert.equal(fig.validVerifiedFigure(good),true);
for (const bad of [{...good,asset:'https://evil.example/a.png'},{...good,asset:'https://example.invalid/reviewed-explanations/assets/a.png'},{...good,asset:'/reviewed-explanations/assets/../outside.png'},{...good,sourceUrl:'javascript:alert(1)'},{...good,license:''}]) assert.equal(fig.validVerifiedFigure(bad),false);
assert.equal(fig.getVerifiedExplanationFigures('unreviewed-question').length,0);
for(const n of ['001','002','003']) assert.equal(fig.getVerifiedExplanationFigures('MOEX-C217-091030-S4004-STAGE1-Q'+n).length,1);
const emphasis=load('lib/inlineExplanationEmphasis.ts',{});
const view=load('components/StructuredExplanationText.tsx',{'@/lib/reviewedExplanations':{hasReviewedExplanation:()=>false},'@/components/ReviewedExplanation':{ReviewedExplanation:()=>null},'@/components/VerifiedExplanationFigures':{VerifiedExplanationFigures:()=>null},'@/components/ReviewedExplanationSupplement':{ReviewedExplanationSupplement:()=>null},'@/lib/inlineExplanationEmphasis':emphasis});
const html=renderToStaticMarkup(React.createElement(view.StructuredExplanationText,{text:'重點 **正確**。\n\n| 項目 | 作用 |\n| --- | --- |\n| & <x> | 比較 |',label:''}));
assert.match(html,/<strong>正確<\/strong>/); assert.match(html,/<table/); assert.match(html,/<th/); assert.match(html,/<td/); assert.match(html,/&amp; &lt;x&gt;/);assert.doesNotMatch(html,/<x>/);
const src=fs.readFileSync('app/api/question-explanation/route.ts','utf8');assert.match(src,/提供一個精簡 Markdown 比較表/);assert.match(src,/不要在生成內容中自行編造題號、圖片、引用或網址/);
console.log('PASS real structured renderer: semantic table, emphasis and escaped text');
console.log('PASS approved local assets only, HTTPS source and required licence; missing catalogue remains empty');
console.log('PASS prompt asks for a table while prohibiting fabricated image or source URLs');
