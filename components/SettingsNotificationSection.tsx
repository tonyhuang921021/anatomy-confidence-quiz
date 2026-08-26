"use client";

import { useState } from "react";
import { FeedbackNotificationBell } from "@/components/FeedbackNotificationBell";
import { MobilePushSettings } from "@/components/MobilePushSettings";

export function SettingsNotificationSection() {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  return (
    <section aria-labelledby="settings-notification-title">
      <div className="border-b border-slate-200 pb-3">
        <h2 id="settings-notification-title" className="text-lg font-semibold text-ink">通知</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">查看留言動態，或決定這台手機要不要接收推播。</p>
      </div>
      <div className="mt-4 grid gap-3">
        <FeedbackNotificationBell
          open={notificationCenterOpen}
          onOpenChange={setNotificationCenterOpen}
          placement="settings"
        />
        <MobilePushSettings />
      </div>
    </section>
  );
}
