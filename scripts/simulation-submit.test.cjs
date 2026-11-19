/** Mock integration, not a live-server/browser test. Executes AST-extracted production callbacks.
 * Renderer tests need React 18 react-test-renderer; set TEST_RENDERER_ROOT if not installed locally.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const OWNER = '11111111-1111-4111-8111-111111111111';
function extract(relative, names) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const file = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map();
  function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.set(node.name.text, node.getText(file).replace(/^export\s+/, ''));
    ts.forEachChild(node, walk);
  }
  walk(file);
  for (const name of names) assert.ok(found.has(name), `Missing actual production function ${name}`);
  return names.map(name => found.get(name)).join('\n');
}
function transpile(source, jsx = false) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined } }).outputText;
}
function loadModule(relative, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transpile(fs.readFileSync(path.join(ROOT, relative), 'utf8'), true), { module, exports: module.exports, require: name => mocks[name] ?? require(name), crypto: require('node:crypto').webcrypto, console });
  return module.exports;
}
const answerEdits = loadModule('lib/quizAnswerEdits.ts');
const source = [
  extract('app/quiz/QuizClient.tsx', ['completeSessionAndNavigate', 'finishExamPresentation', 'buildResultsHref']),
  extract('lib/cloudSync.ts', ['syncSessionsThroughServer', 'pushCompletedSessionToSupabase'])
].join('\n');
function harness({ owner = OWNER, paper = 'med1', outcome = 'success', answerRevision = true } = {}) {
  const attempt = { questionId: 'q1', selectedAnswer: 'A', correctAnswer: 'A', isCorrect: true, confidence: 4, answeredAt: '2026-11-19T00:00:00.000Z' };
  const session = { id: `fixture-${paper}`, subject: paper === 'med1' ? '醫學（一）' : '醫學（二）', settings: { mode: 'simulation', simulationPresentation: 'exam', selectedPaperKey: paper }, questionOrder: ['q1'], attempts: [attempt], ...(answerRevision ? { answerEdits: { schema: 1, baseline: [], entries: { q1: { counter: 1, actor: 'fixture', value: attempt } } } } : {}) };
  const events = { routes: [], finalized: [], pending: [], notices: [], requests: [], busy: [] };
  const state = { outcome, release: null };
  const context = {
    ...answerEdits, Error, console, session, authSession: owner ? { user: { id: owner }, access_token: 'mock-token' } : null,
    latestCurrentSessionRef: { current: session }, completingIds: { current: new Set() }, isSubmittingAnswer: false,
    setIsSubmittingAnswer: value => { context.isSubmittingAnswer = value; events.busy.push(value); },
    setCompletionNotice: value => events.notices.push(value), getActiveStorageUser: () => owner ?? '',
    getSessionWithHydratedEliminatedOptions: value => value, getSessionWithSimulationTiming: value => value,
    queuePendingCompletedSessionUploadForUser: (_owner, value) => { events.pending.push(value); return true; },
    finalizeCompletedSession: value => { events.finalized.push(value); return true; },
    router: { push: value => events.routes.push(value) }, pushQuestionStatsSnapshotToSupabase: async () => {},
    syncCompletedCustomPaper: () => {}, isSavedQuestionReviewSettings: () => false, clearSimulationExamTimerState: () => {},
    setSession: value => { context.session = value; }, saveCurrentSession: () => {}, loadCurrentSession: () => context.session,
    setSubmittedAttempt: () => {}, setSelectedAnswer: () => {},
    assertLegacyCloudSyncAllowed: () => {}, isSupabaseRecoveryMode: () => false, isSupabaseConfigured: () => true,
    getSupabaseBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) } }),
    canonicalizeSessionsForUser: (id, sessions) => sessions.map(value => ({ ...value, id: value.id.startsWith(`user-${id}:`) ? value.id : `user-${id}:${value.id}` })),
    commitUploadedCompletedSessionsForUser: () => {}, getCloudSessionSyncAccessToken: async () => 'mock-token',
    refreshCloudSessionSyncAccessToken: async () => null, CLOUD_SERVER_SYNC_TIMEOUT_MS: 100,
    normalizeSessions: values => values, reconcileServerQuizSession: (_owner, canonical) => canonical,
    fetchWithClientTimeout: async (_url, request) => {
      const requestSession = JSON.parse(request.body).sessions[0]; events.requests.push(requestSession);
      if (state.outcome === 'pending') await new Promise(resolve => { state.release = resolve; });
      if (state.outcome === '409' || state.outcome === '503') return { ok: false, status: Number(state.outcome), json: async () => ({ ok: false }) };
      if (state.outcome === 'missing-ack') return { ok: true, status: 200, json: async () => ({ ok: true, canonicalSessions: [] }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, canonicalSessions: [requestSession] }) };
    }
  };
  vm.createContext(context); vm.runInContext(transpile(source), context);
  return { context, events, state, original: JSON.stringify(session), finish: () => context.finishExamPresentation() };
}
for (const paper of ['med1', 'med2']) {
  test(`mock accepted canonical reply navigates ${paper} through real callbacks`, async () => {
    const h = harness({ paper }); await h.finish();
    assert.equal(h.events.requests.length, 1);
    assert.equal(h.events.finalized.length, 1);
    assert.ok(answerEdits.isAcceptedCompletion(h.events.finalized[0]));
    assert.deepEqual(h.events.finalized[0].attempts, h.events.requests[0].attempts);
    assert.equal(h.events.routes[0], `/simulation-results?sessionId=${encodeURIComponent(`user-${OWNER}:fixture-${paper}`)}`);
    assert.equal(h.context.isSubmittingAnswer, false);
    assert.equal(JSON.stringify(h.context.session), h.original, 'submitted draft was not mutated');
  });
  test(`guest ${paper} completes locally without canonical server gate`, async () => {
    const h = harness({ owner: null, paper }); await h.finish();
    assert.equal(h.events.requests.length, 0); assert.equal(h.events.finalized.length, 1);
    assert.equal(h.events.routes[0], `/simulation-results?sessionId=fixture-${paper}`);
    assert.equal(JSON.stringify(h.context.session), h.original);
  });
}
for (const status of ['409', '503']) test(`mock ${status}: no result, preserved answers, unlocked retry succeeds`, async () => {
  const h = harness({ outcome: status }); await h.finish();
  assert.equal(h.events.routes.length, 0); assert.equal(h.events.finalized.length, 0);
  assert.equal(JSON.stringify(h.context.session), h.original);
  assert.equal(h.context.completingIds.current.size, 0); assert.equal(h.context.isSubmittingAnswer, false);
  assert.ok(h.events.pending.length > 0);
  const notice = h.events.notices.at(-1);
  assert.match(notice, status === '409' ? /作答版本已更新/ : /伺服器尚未確認交卷/);
  if (status === '503') assert.doesNotMatch(notice, /版本已更新/);
  h.state.outcome = 'success'; await h.finish(); assert.equal(h.events.routes.length, 1);
});
test('successful HTTP without canonical acknowledgement cannot bypass completion gate', async () => {
  const h = harness({ outcome: 'missing-ack' }); await h.finish();
  assert.equal(h.events.routes.length, 0); assert.equal(h.events.finalized.length, 0);
  assert.equal(JSON.stringify(h.context.session), h.original); assert.equal(h.context.isSubmittingAnswer, false);
  assert.match(h.events.notices.at(-1), /CANONICAL_ACK_MISSING/);
});
test('pending submit is busy and repeated finish does not send twice', async () => {
  const h = harness({ outcome: 'pending' }); const first = h.finish();
  while (!h.state.release) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.context.isSubmittingAnswer, true); await h.finish();
  assert.equal(h.events.requests.length, 1); h.state.outcome = 'success'; h.state.release(); await first;
  assert.equal(h.events.routes.length, 1); assert.equal(h.context.isSubmittingAnswer, false);
});
// Actual component, with its portal-owning frame replaced by an inspectable boundary.
// This proves notice/controls are passed inside that boundary, not browser pixel visibility.
let rendererRoot;
for (const root of [process.env.TEST_RENDERER_ROOT, ROOT, '/tmp/exam-hook-tests'].filter(Boolean)) {
  try { require.resolve('react-test-renderer', { paths: [root] }); rendererRoot = root; break; } catch {}
}
test('real renderer: notice inside portal child, two confirmations, pending controls disabled', { skip: !rendererRoot && 'Install React 18 react-test-renderer or set TEST_RENDERER_ROOT' }, async () => {
  const React = require(require.resolve('react', { paths: [rendererRoot] }));
  const { create, act } = require(require.resolve('react-test-renderer', { paths: [rendererRoot] }));
  const Frame = ({ children }) => React.createElement('portal-boundary', null, children);
  const Surface = props => React.createElement('exam-surface', props);
  const { OriginalSessionExamRenderer } = loadModule('components/OriginalSessionExamRenderer.tsx', {
    react: React, 'react/jsx-runtime': require(require.resolve('react/jsx-runtime', { paths: [rendererRoot] })),
    '@/lib/examQuestionFlags': { normalizedExamFlags: () => ({}) }, '@/lib/examRendererProjection': { projectExamRenderer: session => session },
    './ExamLikeSurface': { ExamLikeSurface: Surface }, './ExamScreenFrame': { ExamScreenFrame: Frame },
    './ExamEntryGate': { ExamEntryGate: ({ children }) => children }, './ExamLikeSurface.module.css': { default: { root: 'fixture' } }
  });
  let calls = 0; const props = { session: harness().context.session, questions: [{ id: 'q1' }], owner: OWNER, elapsed: 10, paused: false, disabled: false, completionNotice: '', onFinish: () => { calls++; } };
  let tree; await act(async () => { tree = create(React.createElement(OriginalSessionExamRenderer, props)); });
  const boundary = () => tree.root.findByType('portal-boundary');
  await act(async () => boundary().findByType('exam-surface').props.onFinish());
  const confirm = () => boundary().findAllByType('button')[0];
  assert.equal(calls, 0); await act(async () => confirm().props.onClick());
  assert.equal(calls, 0); await act(async () => confirm().props.onClick()); assert.equal(calls, 1);
  await act(async () => tree.update(React.createElement(OriginalSessionExamRenderer, { ...props, disabled: true, completionNotice: '正在確認交卷；請保留此頁。' })));
  assert.equal(boundary().findByProps({ role: 'status' }).children.join(''), '正在確認交卷；請保留此頁。');
  assert.ok(boundary().findAllByType('button').every(button => button.props.disabled));
  assert.equal(confirm().children.join(''), '正在確認交卷…');
  await act(async () => tree.update(React.createElement(OriginalSessionExamRenderer, { ...props, completionNotice: '伺服器尚未確認交卷，請重試。' })));
  assert.equal(confirm().props.disabled, false); assert.match(boundary().findByProps({ role: 'status' }).children.join(''), /請重試/);
  await act(async () => confirm().props.onClick()); assert.equal(calls, 2);
  await act(async () => tree.unmount());
});
