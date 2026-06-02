"use client";

import Link from "next/link";

export function OwnerOnlyNotesLink() {
  return (
    <Link href="/notes" className="secondary-pill justify-between px-4">
      學習筆記
      <span className="text-slate-400">→</span>
    </Link>
  );
}
