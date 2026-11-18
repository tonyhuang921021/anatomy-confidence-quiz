// Isolated browser integration of the production hook; API responses are mocked.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  const cloud = new Map(); let reads=0;
  async function device(){
   const page = await browser.newPage();
   await page.route('https://names.test/**', route=>route.fulfill({body:'<div id="root"></div>',contentType:'text/html'}));
   await page.goto('https://names.test/');
   await page.addScriptTag({path:'node_modules/react/umd/react.development.js'});
   await page.addScriptTag({path:'node_modules/react-dom/umd/react-dom.development.js'});
   await page.exposeFunction('api', async (owner,body,method)=>{
    if(method==='PUT'){if(body.name==='FAIL')return {ok:false,error:'名稱尚未儲存'};cloud.set(`${owner}:${body.id}`,body.name);return {ok:true};}
    reads++;return {ok:true,names:body.ids.flatMap(id=>cloud.has(`${owner}:${id}`)?[{session_id:`user-${owner}:${id}`,name:cloud.get(`${owner}:${id}`)}]:[])};
   });
   await page.evaluate(({names,hook})=>{
    const nm={exports:{}};new Function('module','exports',names)(nm,nm.exports);
    const hm={exports:{}};new Function('module','exports','require',hook)(hm,hm.exports,n=>n==='react'?React:nm.exports);
    window.fetch=async(_url,init)=>{const data=await window.api(init.headers.Authorization.split(' ')[1],JSON.parse(init.body),init.method);return {ok:data.ok,json:async()=>data};};
    const root=ReactDOM.createRoot(document.getElementById('root'));
    function Harness(props){window.current=hm.exports.useSessionNames(props.owner,props.owner,['round1']);return React.createElement('p',null,JSON.stringify(window.current.names));}
    window.renderOwner=owner=>root.render(React.createElement(Harness,{owner}));
    window.renderOwner(undefined);
   },{names:compile('lib/sessionNames.ts'),hook:compile('components/useSessionNames.ts')});
   await page.waitForFunction(()=>window.current);
   return page;
  }
  const one=await device();
  await one.evaluate(()=>{localStorage.setItem('immutable-answer-receipt','unchanged');return current.save('round1','訪客複習')});
  await one.waitForFunction(()=>current.names.round1==='訪客複習');
  await one.evaluate(()=>renderOwner('alice'));await one.waitForFunction(()=>!current.names.round1);
  await one.evaluate(()=>current.save('round1','心臟散題'));await one.waitForFunction(()=>current.names.round1==='心臟散題');
  const two=await device();await two.evaluate(()=>renderOwner('alice'));await two.waitForFunction(()=>current.names.round1==='心臟散題');
  await one.evaluate(()=>renderOwner('bob'));await one.waitForFunction(()=>!current.names.round1);
  await one.evaluate(()=>renderOwner('alice'));await one.waitForFunction(()=>current.names.round1==='心臟散題');
  assert.match(await one.evaluate(async()=>{try{await current.save('round1','FAIL');return 'wrong success'}catch(e){return e.message}}),/尚未儲存/);
  assert.equal(await one.evaluate(()=>current.names.round1),'心臟散題');
  await one.evaluate(()=>current.save('round1',''));await one.waitForFunction(()=>current.names.round1==='');
  await two.evaluate(()=>window.dispatchEvent(new Event('focus')));await two.waitForFunction(()=>current.names.round1==='');
  await one.evaluate(()=>renderOwner(undefined));await one.waitForFunction(()=>current.names.round1==='訪客複習');
  assert.equal(await one.evaluate(()=>localStorage.getItem('immutable-answer-receipt')),'unchanged');
  assert.ok(reads<20,`unexpected repeated fetch: ${reads}`);
  console.log(`PASS guest persistence, account isolation, two-device mocked sync, explicit reset, failure retention, unchanged receipt; ${reads} reads`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
