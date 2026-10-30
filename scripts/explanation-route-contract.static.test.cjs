const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('app/api/question-explanation/route.ts','utf8');const p=s.slice(s.indexOf('export async function POST('));
assert.ok(p.includes('handleExplanation(body'));assert.ok(p.indexOf('hasReviewedExplanation(id.trim())') < p.indexOf('ai_guard_sync_batch'));
assert.ok(p.indexOf('db.auth.getUser(body.accessToken)') < p.indexOf('ai_guard_sync_batch'));assert.ok(p.indexOf('ai_guard_sync_batch') < p.indexOf('handleExplanation(body'));assert.ok(!p.includes('await upsertSharedExplanationOverride('));assert.ok(!p.includes('await syncSharedExplanationOverrides('));
assert.ok(p.includes('resolveTrustedExplanationQuestion(id)'));assert.ok(p.includes('ai_guard_reserve'));assert.ok(p.includes('ai_guard_read_reservation'));assert.ok(!p.includes('.from("ai_guard_requests")'));assert.ok(p.includes('ai_guard_start_call'));assert.ok(p.includes('ai_guard_settle_call'));assert.ok(p.includes('ai_guard_commit'));assert.ok(p.includes('ai_guard_close'));
assert.ok(p.includes('QUESTION_EXPLANATION_PROMO_VERIFIED'));assert.ok(p.includes('maxCalls:1'));assert.ok(p.includes('usageKnown ? result.usage : null'));
assert.ok(!p.includes('body.previousQuestion'));assert.ok(!p.includes('body.previousOverride'));assert.ok(p.includes('buildQuestionExplanationPrompt({question:{...q'));
console.log('PASS static route wiring assertions only; no Next, SQL or API execution.');
