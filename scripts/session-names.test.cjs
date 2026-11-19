const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name] ?? require(name), process, console });
  return module.exports;
}
const names = load('lib/sessionNames.ts');
test('name validation, default reset and guest corruption recovery', () => {
  assert.equal(names.normalizeSessionName('  心臟複習  '), '心臟複習');
  assert.equal(names.normalizeSessionName('  '), '');
  assert.equal(names.normalizeSessionName('a'.repeat(81)), null);
  assert.equal(names.normalizeSessionName(12), null);
  assert.equal(JSON.stringify(names.parseGuestSessionNames('{')), '{}');
  assert.equal(JSON.stringify(names.parseGuestSessionNames('{"round1":"我的名稱","bad":12}')), '{"round1":"我的名稱"}');
});
test('owner namespaces reject another account rather than stripping its owner', () => {
  assert.equal(names.ownedNameSessionId('alice', 'user-bob:round1'), null);
  assert.equal(names.ownedNameSessionId('alice', 'user-alice:round1'), 'user-alice:round1');
  assert.equal(names.ownedNameSessionId('alice', 'round1'), 'user-alice:round1');
});
function setup({ authed = true, complete = true, unavailable = false } = {}) {
  const queries = [], writes = [];
  const db = { auth: { getUser: async () => ({ data: { user: authed ? { id: 'alice' } : null }, error: null }) }, from(table) {
    const q = { table, filters: [] }; queries.push(q);
    return { select() { return this; }, eq(k,v) { q.filters.push([k,v]); return this; }, in(k,v) { q.filters.push([k,v]); return Promise.resolve({ data: [{session_id:'user-alice:round1',name:'腎臟'}], error: unavailable ? {} : null }); }, maybeSingle() { return Promise.resolve({ data: complete ? { id: 'user-alice:round1', completed_at: 'today' } : null, error: null }); }, upsert(row) { writes.push({table,row}); return Promise.resolve({error: unavailable ? {} : null}); } };
  }};
  const route = load('app/api/quiz-session-names/route.ts', { 'next/server': { NextResponse: { json(body, init) { return { body, status: init?.status ?? 200 }; } } }, '@supabase/supabase-js': { createClient: () => db }, '@/lib/sessionNames': names, '@/lib/supabase/recoveryMode': { isSupabaseRecoveryMode: () => false } });
  return { route, queries, writes };
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-test-only';
const req = body => ({ headers: { get: () => 'Bearer fake' }, json: async () => body });
test('authenticated rename writes metadata only, never answer/settings/receipt', async () => {
  const {route, queries, writes} = setup();
  assert.equal((await route.PUT(req({id:'round1',name:'  第三次練習 '}))).status,200);
  assert.equal(writes.length,1); assert.equal(writes[0].table,'quiz_session_names');
  assert.equal(writes[0].row.name,'第三次練習');
  assert.deepEqual(Object.keys(writes[0].row).sort(),['name','session_id','updated_at','user_id']);
  assert.deepEqual(queries[0].filters,[['user_id','alice'],['id','user-alice:round1']]);
});
test('unauthenticated, foreign, unfinished and unavailable writes cannot report success', async () => {
  for(const [options, body, status] of [[{authed:false},{id:'round1',name:'x'},401],[{},{id:'user-bob:round1',name:'x'},400],[{complete:false},{id:'round1',name:'x'},409],[{unavailable:true},{id:'round1',name:'x'},503]]) {
    const {route,writes} = setup(options); assert.equal((await route.PUT(req(body))).status,status);
    if(!options.unavailable) assert.equal(writes.length,0);
  }
});
test('cross-device reads are scoped by verified owner and requested ids', async () => {
  const {route,queries} = setup(); const response = await route.POST(req({ids:['round1']}));
  assert.equal(response.status,200); assert.equal(response.body.names[0].name,'腎臟');
  assert.equal(JSON.stringify(queries[0].filters),JSON.stringify([['user_id','alice'],['session_id',['user-alice:round1']]]));
  assert.equal((await route.POST(req({ids:['user-bob:round1']}))).status,400);
});
test('UI all modes use metadata; name edits never rewrite the completed session', () => {
  const ui = fs.readFileSync('app/results/ResultsClient.tsx','utf8');
  const handler = ui.split('async function handleSaveSessionName()')[1].split('function handleOpenFullscreenReview')[0];
  assert.ok(handler.includes('resultNames.save'));
  assert.ok(!/saveCompletedSession|pushCompletedSessionToSupabase|mode:/.test(handler));
  assert.ok(ui.includes('aria-label="作答紀錄名稱"'));
  assert.ok(ui.includes('currentCustomName ? `${currentCustomName}結果分析`'));
});
