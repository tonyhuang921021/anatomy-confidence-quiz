import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";

export default function ResetPasswordPage() {
  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card p-6 sm:p-8">
        <p className="eyebrow">Password Reset</p>
        <h1 className="display-title mt-3 text-4xl sm:text-5xl">重設密碼</h1>
        <p className="body-soft mt-4 max-w-2xl text-sm leading-7 sm:text-base">
          如果你是從重設密碼信點進來，下面會出現設定新密碼的欄位。完成後就能回到網站用新密碼登入。
        </p>
        <Link href="/" className="secondary-pill mt-5 inline-flex">
          回首頁
        </Link>
      </section>

      <AuthPanel />
    </main>
  );
}
