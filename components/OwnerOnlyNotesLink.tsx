"use client";

import Link from "next/link";

export function OwnerOnlyNotesLink() {
  return (
    <Link href="/notes" className="secondary-pill px-4">
      學習筆記
    </Link>
  );
}
