import { strict as assert } from 'node:assert';
import { buildOpenAITextRequest } from '../lib/openai.ts';
assert.deepEqual(buildOpenAITextRequest('Q', 2400, 'gpt-6.1-sol', 'low'), {model:'gpt-6.1-sol',input:'Q',max_output_tokens:2400,reasoning:{effort:'low'}});
assert.deepEqual(buildOpenAITextRequest('Q', 2400, 'gpt-6.1-sol', 'default'), {model:'gpt-6.1-sol',input:'Q',max_output_tokens:2400});
assert.deepEqual(buildOpenAITextRequest('Q', 1800, 'gpt-6-luna'), {model:'gpt-6-luna',input:'Q',max_output_tokens:1800});
assert.throws(()=>buildOpenAITextRequest('Q', 1800, 'gpt-6-luna', 'low'));
assert.throws(()=>buildOpenAITextRequest('Q', 1800, 'gpt-6.1-sol', 'none'));
console.log('PASS pure payload tests: low/default, prior default preserved, reject unsupported modes. No provider call.');
