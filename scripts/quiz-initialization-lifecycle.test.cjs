const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual effect body, including its async cleanup, without a DOM.
// Browser coverage remains separate; these mocks isolate lifecycle ownership.
const source = fs.readFileSync('app/quiz/QuizClient.tsx', 'utf8');
const ast = ts.createSourceFile('QuizClient.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
      node.arguments[0]?.getText(ast).includes('async function initializeSession()')) effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect, 'The real quiz initialization effect must be found');
const compiled = ts.transpileModule(`globalThis.runEffect = ${effect};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness() {
  const pending = [], events = [];
  const settings = { mode: 'simulation', subjectFilter: '醫學（一）', questionCount: 80 };
  const nextSession = { id: 'new-paper', questionOrder: Array.from({ length: 80 }, (_, i) => `Q${i+1}`), currentQuestionIndex: 0, attempts: [] };
  const initializedSessionRef = { current: false };
  const context = {
    initializedSessionRef, authLoading: false, authSession: null,
    latestCurrentSessionRef: { current: null }, confidenceRef: { current: 4 },
    QUIZ_CLASSIFICATION_OVERRIDE_TIMEOUT_MS: 1, DEFAULT_QUIZ_SETTINGS: settings,
    URLSearchParams, window: { location: { search: '?new=1', href: 'https://local.test/quiz?new=1' }, history: { state: null, replaceState: () => events.push('url') } },
    withTimeoutFallback: value => value,
    loadConfirmedQuestionClassificationOverrides: () => new Promise((resolve,reject) => pending.push({resolve,reject})),
    setClassificationOverrides: () => events.push('overrides'),
    loadCurrentSession: () => null,
    getQuizSessionNavigationIntent: () => ({ forceNew: true }),
    resolveStartSettingsFromSearchParams: () => ({ settings }),
    normalizeLegacySettings: value => value,
    getExpectedSimulationQuestionCount: () => 80,
    canReuseCurrentSession: () => false,
    getRequestedResumeStatus: () => 'not-requested',
    loadCompletedHistorySessionsForUser: () => [],
    getQuestionBankBySubjectFilter: () => [],
    getQuestionBankBySubjects: () => [],
    createSession: () => nextSession,
    clearCurrentSession: () => events.push('clear'),
    setSession: value => events.push(value ? 'session' : 'null-session'),
    saveCurrentSession: () => events.push('save'),
    scheduleCurrentSessionCloudSync: () => events.push('sync'),
    getQuizUrlAfterConsumingLaunchIntent: () => '/quiz?resume=1',
    resetQuestionUI: () => events.push('reset-ui'),
    setLoadIssue: value => { if (value) events.push('error'); },
    setMounted: value => { if (value) events.push('mounted'); }
  };
  vm.createContext(context); vm.runInContext(compiled, context);
  return { context, pending, events, ref: initializedSessionRef, setup: () => context.runEffect() };
}

test('StrictMode setup-cleanup-setup restarts initialization and commits only the live run', async () => {
  const h=harness(); const cleanup=h.setup(); cleanup(); const liveCleanup=h.setup();
  assert.equal(h.pending.length,2); assert.equal(typeof liveCleanup,'function');
  h.pending[0].resolve({}); await tick(); assert.deepEqual(h.events,[]);
  h.pending[1].resolve({}); await tick();
  assert.equal(h.events.filter(x=>x==='save').length,1);
  assert.equal(h.events.filter(x=>x==='mounted').length,1);
});

test('cancelled run resolving after its replacement cannot clear or overwrite the new session', async () => {
  const h=harness(); const cleanup=h.setup(); cleanup(); h.setup();
  assert.equal(h.pending.length,2);
  h.pending[1].resolve({}); await tick(); const committed=[...h.events];
  h.pending[0].resolve({}); await tick(); assert.deepEqual(h.events,committed);
});

test('cancelled rejection does not unlock the newer in-flight initializer', async () => {
  const h=harness(); const cleanup=h.setup(); cleanup(); h.setup();
  assert.equal(h.pending.length,2);
  h.pending[0].reject(Error('old request')); await tick();
  assert.equal(h.ref.current,true); assert.deepEqual(h.events,[]);
  h.setup(); assert.equal(h.pending.length,2);
  h.pending[1].resolve({}); await tick(); assert.ok(h.events.includes('mounted'));
});

test('completed initialization stays locked across subsequent dependency changes', async () => {
  const h=harness(); const cleanup=h.setup(); h.pending[0].resolve({}); await tick();
  cleanup(); h.setup(); assert.equal(h.pending.length,1);
  assert.equal(h.events.filter(x=>x==='save').length,1); assert.equal(h.ref.current,true);
});

test('unmount while pending performs no storage, URL, UI, or sync writes after resolution', async () => {
  const h=harness(); const cleanup=h.setup(); cleanup(); h.pending[0].resolve({}); await tick();
  assert.deepEqual(h.events,[]); assert.equal(h.ref.current,false);
});

test('live initialization failure exits loading and preserves the existing recovery behavior', async () => {
  const h=harness(); h.setup(); h.pending[0].reject(Error('current request')); await tick();
  assert.ok(h.events.includes('error')); assert.ok(h.events.includes('mounted'));
  assert.equal(h.events.filter(x=>x==='save').length,0); assert.equal(h.ref.current,false);
});
