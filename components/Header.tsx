"use client";

import { Clock3, Settings, UserRound } from "lucide-react";

type HeaderProps = {
  apiKeysConfigured: boolean;
  onOpenSettings: () => void;
};

export function Header({ apiKeysConfigured, onOpenSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-app-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-app-primary to-app-blue text-sm font-semibold text-white shadow-sm">
            AI
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-normal text-app-text">
              AI Makeup Transfer Tool
            </h1>
            <p className="text-xs text-app-muted">GPT-5.5 analysis mock workflow</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-medium text-app-text transition hover:border-app-primary/50 hover:text-app-primary"
          >
            <Clock3 className="h-4 w-4" />
            历史记录
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="设置"
              onClick={onOpenSettings}
              className="grid h-10 w-10 place-items-center rounded-xl border border-app-border bg-white text-app-muted transition hover:border-app-primary/50 hover:text-app-primary"
            >
              <Settings className="h-4 w-4" />
            </button>
            <span
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                apiKeysConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-app-border bg-white text-app-muted"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  apiKeysConfigured ? "bg-emerald-500" : "bg-app-muted/40"
                }`}
              />
              {apiKeysConfigured ? "Key 已配置" : "未配置 Key"}
            </span>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-app-border bg-[#F3F4F8] text-app-muted">
            <UserRound className="h-5 w-5" />
          </div>
        </nav>
      </div>
    </header>
  );
}
