import { ArrowUpRight, Link2 } from "lucide-react";

type Source = { href: string; label: string };
// Keep opaque/unrecognized legacy text intact; only move unambiguous HTTP(S) citations.
const link = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const bare = /^https?:\/\/[^\s]+$/;

function safeHref(href: string) {
  try { const u = new URL(href); return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password; }
  catch { return false; }
}

export function explanationSources(text: string) {
  const links = new Map<string, Source>();
  const add = (label: string, href: string) => { if (safeHref(href) && !links.has(href)) links.set(href, { href, label }); };
  for (const match of text.matchAll(link)) add(match[1], match[2]);
  return {
    links,
    addRows(rows: string[]) {
      const checks = rows.map(row => {
        const line = row.trim().replace(/^[-*]\s+/, "").trim();
        if (bare.test(line) && safeHref(line)) { add(line, line); return true; }
        const matches = [...line.matchAll(link)].filter(m => safeHref(m[2]));
        // A bibliographic row can carry prose. Move the whole label, not just its generic “PubMed” link.
        if (matches.length !== 1 || !line.endsWith(matches[0][0]) && !line.endsWith(`${matches[0][0]})`)) return false;
        const [whole, label, href] = matches[0];
        const citation = line.replace(whole, "").replace(/\(\s*\)\s*$/, "").replace(/\*+/g, "").trim();
        links.set(href, {href, label: citation || label});
        return true;
      });
      const removable = checks.length > 0 && checks.every(Boolean);
      return removable;
    }
  };
}

export function stripCollectedCitations(text: string, citations: ReadonlyMap<string, Source>) {
  return text.replace(/ ?\(\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)\)|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (whole, _label, href, prose, proseHref) => citations.has(href ?? proseHref) ? (prose ?? "") : whole);
}

export function SplitExplanationSources({ sources }: { sources: Source[] }) {
  return <details className="explanation-source-details">
    <summary className="explanation-source-trigger" title="資料來源" aria-label="資料來源"><Link2 size={17} aria-hidden="true" /></summary>
    <div className="explanation-source-panel border border-slate-200 bg-white shadow-card">
      <ul className="space-y-1">
        {sources.map(source => <li key={source.href}><a className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-brand-800 hover:bg-brand-50 hover:underline" href={source.href} target="_blank" rel="noopener noreferrer"><span className="min-w-0 break-words">{source.label}</span><ArrowUpRight size={14} className="mt-1 shrink-0" aria-hidden="true" /></a></li>)}
      </ul>
    </div>
  </details>;
}
