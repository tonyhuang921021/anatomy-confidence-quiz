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

test("大型錯題複習設定會用 startSettingsToken 交接完整題池", () => {
  withMockWindow(new MemoryStorage(), () => {
    const settings = makeReviewSettings(140);
    const href = buildNewQuizHref(settings);

    assert.match(href, /startSettingsToken=/);
    assert.doesNotMatch(href, /startSettings=/);

    const resolved = resolveStartSettingsFromSearchParams(getHrefSearchParams(href));
    assert.equal(resolved.error, undefined);
    assert.equal(resolved.settings?.mode, "review");
    assert.equal(resolved.settings?.subjectFilter, "藥理學");
    assert.equal(resolved.settings?.customQuestionIds?.length, 140);
    assert.equal(resolved.settings?.strictCustomQuestionPool, true);
  });
});

test("大型設定暫存失敗時會回傳錯誤參數，避免測驗頁讀舊設定", () => {
  const failingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage full");
    },
    removeItem: () => undefined
  };

  withMockWindow(failingStorage, () => {
    const href = buildNewQuizHref(makeReviewSettings(140));

    assert.match(href, /startSettingsError=too-large/);

    const resolved = resolveStartSettingsFromSearchParams(getHrefSearchParams(href));
    assert.equal(resolved.settings, null);
    assert.equal(resolved.error, "too-large");
  });
});
