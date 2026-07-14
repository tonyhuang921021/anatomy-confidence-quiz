"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAISimulationPaperKeyFromQuestionId,
  loadSavedAISimulationQuestions
} from "@/lib/savedQuestionBank";
import type { Question } from "@/types/quiz";

export function useSavedAISimulationQuestions(questionIds: string[]) {
  const requestKey = useMemo(
    () =>
      Array.from(
        new Set(
          questionIds
            .map((questionId) => questionId.trim())
            .filter((questionId) => Boolean(getAISimulationPaperKeyFromQuestionId(questionId)))
        )
      )
        .sort()
        .join("\n"),
    [questionIds]
  );
  const [loadedState, setLoadedState] = useState<{
    requestKey: string;
    questions: Question[];
  }>({ requestKey: "", questions: [] });

  useEffect(() => {
    if (!requestKey) {
      setLoadedState({ requestKey: "", questions: [] });
      return;
    }

    let cancelled = false;
    void loadSavedAISimulationQuestions(requestKey.split("\n"))
      .then((questions) => {
        if (!cancelled) setLoadedState({ requestKey, questions });
      })
      .catch(() => {
        if (!cancelled) setLoadedState({ requestKey, questions: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return {
    questions: loadedState.requestKey === requestKey ? loadedState.questions : [],
    isLoading: Boolean(requestKey) && loadedState.requestKey !== requestKey
  };
}
