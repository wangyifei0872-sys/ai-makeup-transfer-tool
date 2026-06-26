"use client";

import { Sparkles } from "lucide-react";
import {
  FIXED_GPT_MODEL,
  FIXED_IMAGE_MODEL,
  FIXED_RELAY_SERVICE_NAME
} from "@/lib/relayConfig";
import {
  type EditScope,
  type GenerationSettings,
  type MakeupIntensity,
  type OutputCount,
  type OutputResolution,
  type PreservationLevel
} from "@/lib/mock";

type ControlPanelProps = {
  settings: GenerationSettings;
  isGenerating: boolean;
  onSettingsChange: (settings: GenerationSettings) => void;
  onGenerate: () => void;
};

type Option<T extends string | number> = {
  label: string;
  value: T;
};

const intensityOptions: Option<MakeupIntensity>[] = [
  { label: "轻度", value: "light" },
  { label: "中度", value: "medium" },
  { label: "强烈", value: "strong" }
];

const scopeOptions: Option<EditScope>[] = [
  { label: "全脸", value: "full-face" },
  { label: "眼妆", value: "eyes" },
  { label: "唇妆", value: "lips" },
  { label: "腮红", value: "blush" },
  { label: "高光", value: "highlight" }
];

const preservationOptions: Option<PreservationLevel>[] = [
  { label: "严格保留", value: "strict" },
  { label: "普通", value: "normal" },
  { label: "允许轻微优化", value: "soft-optimize" }
];

const outputOptions: Option<OutputCount>[] = [
  { label: "1张", value: 1 },
  { label: "2张", value: 2 },
  { label: "4张", value: 4 }
];

const outputResolutionOptions: Option<OutputResolution>[] = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" }
];

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-app-text">{label}</div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`min-h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                selected
                  ? "border-transparent bg-app-primary text-white shadow-sm shadow-app-primary/20"
                  : "border-app-border bg-white text-app-muted hover:border-app-primary/50 hover:text-app-primary"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ControlPanel({
  settings,
  isGenerating,
  onSettingsChange,
  onGenerate
}: ControlPanelProps) {
  return (
    <section className="flex min-h-[calc(100vh-112px)] flex-col rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-app-text">参数设置</h2>
        <p className="mt-1 text-sm text-app-muted">设置妆容迁移范围、强度和输出数量。</p>
      </div>

      <div className="space-y-6">
        <SegmentedControl
          label="妆容强度"
          options={intensityOptions}
          value={settings.intensity}
          onChange={(intensity) => onSettingsChange({ ...settings, intensity })}
        />
        <SegmentedControl
          label="修改范围"
          options={scopeOptions}
          value={settings.scope}
          onChange={(scope) => onSettingsChange({ ...settings, scope })}
        />
        <SegmentedControl
          label="保留原图程度"
          options={preservationOptions}
          value={settings.preservation}
          onChange={(preservation) => onSettingsChange({ ...settings, preservation })}
        />
        <SegmentedControl
          label="输出数量"
          options={outputOptions}
          value={settings.outputCount}
          onChange={(outputCount) => onSettingsChange({ ...settings, outputCount })}
        />
        <SegmentedControl
          label="输出分辨率"
          options={outputResolutionOptions}
          value={settings.outputResolution}
          onChange={(outputResolution) => onSettingsChange({ ...settings, outputResolution })}
        />

        {settings.outputResolution === "2K" || settings.outputCount !== 1 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            线上生成可能较慢，建议先用 1K / 1 张测试；稳定后再尝试 2K 或多张输出。
          </div>
        ) : null}

        <div className="rounded-2xl border border-app-border bg-[#F8FAFF] p-4">
          <div className="text-sm font-semibold text-app-text">固定模型配置</div>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
              <dt className="font-semibold text-app-muted">中转服务</dt>
              <dd className="font-medium text-app-text">{FIXED_RELAY_SERVICE_NAME}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
              <dt className="font-semibold text-app-muted">GPT 分析模型</dt>
              <dd className="font-mono text-app-text">{FIXED_GPT_MODEL}</dd>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <dt className="font-semibold text-app-muted">生图模型</dt>
              <dd className="mt-1 break-all font-mono text-app-text">{FIXED_IMAGE_MODEL.model}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-app-primary to-app-blue px-5 text-sm font-semibold text-white shadow-lg shadow-app-primary/20 transition hover:opacity-95 disabled:opacity-70"
        >
          <Sparkles className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "生成中..." : "开始生成妆容"}
        </button>
      </div>
    </section>
  );
}
