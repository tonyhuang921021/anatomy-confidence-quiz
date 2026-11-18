"use client";
import { useEffect, useRef, useState } from "react";
import { canonicalNameSessionId, GUEST_SESSION_NAMES_KEY, normalizeSessionName, parseGuestSessionNames } from "@/lib/sessionNames";

export function useSessionNames(owner: string | undefined, token: string | undefined, ids: string[]) {
  const scope = owner ?? "guest";
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const generation = useRef(0);
  const [stored, setStored] = useState<{ scope: string; names: Record<string, string> }>({ scope, names: {} });
  const [readError, setReadError] = useState("");
  const idsKey = JSON.stringify(Array.from(new Set(ids)).sort());
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      const version = ++generation.current;
      try {
        let names: Record<string, string> = {};
        if (!owner) names = parseGuestSessionNames(localStorage.getItem(GUEST_SESSION_NAMES_KEY));
        else {
          if (!token) return;
          const requested: string[] = JSON.parse(idsKey);
          for (let offset = 0; offset < requested.length; offset += 100) {
            const response = await fetch("/api/quiz-session-names", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ids: requested.slice(offset, offset + 100) }), signal: controller.signal, cache: "no-store" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "無法讀取名稱。");
            for (const row of data.names) names[canonicalNameSessionId(row.session_id)] = row.name;
          }
        }
        if (active && scopeRef.current === scope && generation.current === version) {
          setStored({ scope, names });
          setReadError("");
        }
      } catch (error) {
        if (active && generation.current === version) setReadError(error instanceof Error ? error.message : "無法讀取名稱。");
      }
    }
    setReadError("");
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { active = false; controller.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [scope, owner, token, idsKey]);

  async function save(id: string, value: string) {
    const name = normalizeSessionName(value);
    if (name === null) throw new Error("名稱最多 80 字。");
    const key = canonicalNameSessionId(id);
    ++generation.current; // A read started before this explicit edit must not overwrite it.
    if (owner) {
      if (!token) throw new Error("請先登入。");
      const response = await fetch("/api/quiz-session-names", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "名稱尚未儲存。");
    } else {
      const names = parseGuestSessionNames(localStorage.getItem(GUEST_SESSION_NAMES_KEY));
      localStorage.setItem(GUEST_SESSION_NAMES_KEY, JSON.stringify({ ...names, [key]: name }));
    }
    if (scopeRef.current !== scope) return false;
    ++generation.current;
    setStored(current => ({ scope, names: { ...(current.scope === scope ? current.names : {}), [key]: name } }));
    setReadError("");
    return true;
  }
  const names = stored.scope === scope ? stored.names : {};
  return { names, save, readError };
}
