import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNewQuizHref,
  resolveStartSettingsFromSearchParams
} from "./startSettingsUrl";
import type { QuizSettings } from "../types/quiz";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

function withMockWindow<T>(sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">, fn: () => T) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage }
  });

  try {
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

function makeReviewSettings(questionCount: number): QuizSettings {
  return {
    mode: "review",
    questionCount,
    subjectFilter: "藥理學",
    subjectFilters: ["藥理學"],
    strictCustomQuestionPool: true,
    customPoolLabel: "散題待複習題庫",
    customQuestionIds: Array.from({ length: questionCount }, (_, index) =>
      `MOEX-TEST-PHARMA-Q${String(index + 1).padStart(3, "0")}`
    )
  };
}

function getHrefSearchParams(href: string) {
  return new URL(href, "https://example.test").searchParams;
}

test("大型錯題複習 ID 清單會直接用 URL 交接，避免依賴瀏覽器暫存", () => {
  withMockWindow(new MemoryStorage(), () => {
    const settings = makeReviewSettings(260);
    const href = buildNewQuizHref(settings);

    assert.match(href, /startSettings=/);
    assert.doesNotMatch(href, /startSettingsToken=/);

    const resolved = resolveStartSettingsFromSearchParams(getHrefSearchParams(href));
    assert.equal(resolved.error, undefined);
    assert.equal(resolved.settings?.mode, "review");
    assert.equal(resolved.settings?.subjectFilter, "藥理學");
    assert.equal(resolved.settings?.customQuestionIds?.length, 260);
    assert.deepEqual(resolved.settings?.customQuestionIds?.slice(0, 3), [
      "MOEX-TEST-PHARMA-Q001",
      "MOEX-TEST-PHARMA-Q002",
      "MOEX-TEST-PHARMA-Q003"
    ]);
    assert.equal(resolved.settings?.strictCustomQuestionPool, true);
  });
});

test("大型 ID 清單即使暫存失敗也能從 URL 還原", () => {
  const failingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage full");
    },
    removeItem: () => undefined
  };

  withMockWindow(failingStorage, () => {
    const href = buildNewQuizHref(makeReviewSettings(260));

    assert.match(href, /startSettings=/);

    const resolved = resolveStartSettingsFromSearchParams(getHrefSearchParams(href));
    assert.equal(resolved.error, undefined);
    assert.equal(resolved.settings?.customQuestionIds?.length, 260);
  });
});

test("真的超大且暫存失敗時會回傳錯誤參數，避免測驗頁讀舊設定", () => {
  const failingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage full");
    },
    removeItem: () => undefined
  };

  withMockWindow(failingStorage, () => {
    const hugeSettings: QuizSettings = {
      ...makeReviewSettings(80),
      customQuestionPayload: Array.from({ length: 80 }, (_, index) => ({
        id: `HUGE-Q${index}`,
        subject: "藥理學",
        chapter: "大型題池",
        section: "暫存測試",
        stem: "很長的題幹".repeat(80),
        options: {
          A: "A".repeat(80),
          B: "B".repeat(80),
          C: "C".repeat(80),
          D: "D".repeat(80)
        },
        answer: "A",
        explanation: "很長的詳解".repeat(80),
        testedConcept: "大型設定測試"
      }))
    };
    const href = buildNewQuizHref(hugeSettings);

    assert.match(href, /startSettingsError=too-large/);

    const resolved = resolveStartSettingsFromSearchParams(getHrefSearchParams(href));
    assert.equal(resolved.settings, null);
    assert.equal(resolved.error, "too-large");
  });
});
