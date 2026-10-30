// The guarded route replaces the prior per-user counter with atomic reservation.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('guarded route keeps single call and verified unknown stop',()=>{const s=fs.readFileSync('app/api/question-explanation/route.ts','utf8');assert.match(s,/maxCalls:1/);assert.match(s,/ai_guard_reserve/);assert.match(s,/ai_guard_mark_unknown/);assert.match(s,/disabled_held/)});
