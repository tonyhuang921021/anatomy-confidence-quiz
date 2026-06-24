import Link from "next/link";
import { ResourceShareHub } from "@/components/ResourceShareHub";

export default function ResourcesPage() {
  return (
    <main className="shell">
      <div className="mb-5">
        <Link href="/" className="text-sm font-black text-slate-500 hover:text-emerald-800">
          ← 返回首頁
        </Link>
      </div>
      <ResourceShareHub />
    </main>
  );
}
