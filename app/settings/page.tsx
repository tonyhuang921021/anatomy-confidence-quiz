import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { LazyAuthPanel } from "@/components/LazyAuthPanel";
import { MobileInstallGuide } from "@/components/MobileInstallGuide";
import { MobilePushSettings } from "@/components/MobilePushSettings";

export default function SettingsPage() {
  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel p-5 sm:p-7">
        <p className="workspace-page-kicker">設定</p>
        <h1 className="workspace-page-title">手機與通知</h1>
        <p className="mt-3 text-slate-500">通知、主畫面安裝集中在這裡，需要時再調整。</p>

        <div className="mt-6 grid gap-4">
          <MobilePushSettings />
          <MobileInstallGuide />
        </div>

        <details className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-ink sm:px-5">
            帳號與作答偏好
          </summary>
          <div className="border-t border-slate-100 p-4 sm:p-5">
            <ClientSectionBoundary title="帳號與作答偏好">
              <LazyAuthPanel eager compactHeader />
            </ClientSectionBoundary>
          </div>
        </details>
      </section>
    </main>
  );
}
