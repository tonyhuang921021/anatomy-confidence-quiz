import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptionSentences, findCaptionSentenceAtTime } from "./captionSentences";

test("跨字幕的同一句會合併到句號，不在語意中間換段", () => {
  const sentences = buildCaptionSentences([
    { id: "cue-1", startSec: 0, endSec: 2, text: "老師先說第一段，" },
    { id: "cue-2", startSec: 2, endSec: 5, text: "接著把同一句說完。" },
    { id: "cue-3", startSec: 5, endSec: 7, text: "下一句。" }
  ]);

  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].text, "老師先說第一段，接著把同一句說完。");
  assert.deepEqual(sentences[0].sourceCueIds, ["cue-1", "cue-2"]);
  assert.equal(findCaptionSentenceAtTime(sentences, 3)?.id, sentences[0].id);
  assert.equal(findCaptionSentenceAtTime(sentences, 6)?.text, "下一句。");
});

test("同一字幕內有多句時依標點拆句並保留可點時間", () => {
  const sentences = buildCaptionSentences([
    { id: "cue-1", startSec: 10, endSec: 14, text: "第一句。第二句？第三句！" }
  ]);

  assert.deepEqual(sentences.map((sentence) => sentence.text), ["第一句。", "第二句？", "第三句！"]);
  assert.ok(sentences[0].endSec <= sentences[1].startSec);
  assert.ok(sentences[1].endSec <= sentences[2].startSec);
});

test("影片結尾沒有句號時仍保留最後一句", () => {
  const sentences = buildCaptionSentences([
    { id: "cue-1", startSec: 0, endSec: 2, text: "最後一段尚未加標點" }
  ]);

  assert.equal(sentences.length, 1);
  assert.equal(sentences[0].text, "最後一段尚未加標點");
});
