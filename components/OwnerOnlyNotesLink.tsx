"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { isAdminEmail } from "@/lib/adminAccess";

export function OwnerOnlyNotesLink() {
  const { user } = useAuth();

  if (!isAdminEmail(user?.email)) {
    return null;
  }

  return (
    <Link href="/notes" className="secondary-pill justify-between px-4">
      學習筆記
      <span className="text-slate-400">→</span>
    </Link>
  );
}
