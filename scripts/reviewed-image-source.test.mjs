import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewedImageSource } from '../lib/reviewedImageSource.ts';
test('inline viewer accepts only same-origin reviewed assets',()=>{
 const origin='https://example.test';
 assert.equal(reviewedImageSource('/reviewed-explanations/assets/example.png',origin),'https://example.test/reviewed-explanations/assets/example.png');
 for(const value of [null,'javascript:alert(1)','data:image/png;base64,AAAA','//evil.test/reviewed-explanations/assets/x.png','https://evil.test/reviewed-explanations/assets/x.png','/reviewed-explanations/assets/../../api/private','/reviewed-explanations/assets/%2e%2e/%2e%2e/api/private','https://example.test.evil/reviewed-explanations/assets/x.png','/other/assets/x.png']) assert.equal(reviewedImageSource(value,origin),null,String(value));
});
