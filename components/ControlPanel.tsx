"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import {
  FIXED_GPT_MODEL,
  FIXED_IMAGE_MODEL,
  FIXED_RELAY_SERVICE_NAME
} from "@/lib/relayConfig";
import {
  type EditScope,
  type GenerationSettings,
  type MakeupIntensity,
  type OutputAspectRatio,
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
  { label: "轻微优化", value: "soft-optimize" }
];

const outputOptions: Option<OutputCount>[] = [
  { label: "1 张", value: 1 },
  { label: "2 张", value: 2 },
  { label: "4 张", value: 4 }
];

const outputResolutionOptions: Option<OutputResolution>[] = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" }
];

const outputAspectRatioOptions: Option<OutputAspectRatio>[] = [
  { label: "原图比例", value: "original" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "4:3", value: "4:3" },
  { label: "2:3", value: "2:3" },
  { label: "3:2", value: "3:2" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" }
];

function PanelTitle() {
  return (
    <div className="mb-7 flex items-start gap-4">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6D5DF6] text-sm font-bold text-white shadow-sm shadow-[#6D5DF6]/25">
        2
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">参数设置</h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          调整妆容迁移范围、输出规格和生成方式。
        </p>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
      <div className="mb-4 text-sm font-semibold text-gray-900">{title}</div>
      <div className="divide-y divide-gray-200/80">{children}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  columnCount
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columnCount: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`h-10 whitespace-nowrap rounded-xl border px-2 text-sm font-medium transition ${
              selected
                ? "border-transparent bg-[#6D5DF6] text-white shadow-sm shadow-[#6D5DF6]/25"
                : "border-gray-200 bg-white text-gray-600 shadow-sm shadow-gray-900/[0.03] hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FixedModelDetails() {
  return (
    <details className="group overflow-hidden rounded-2xl border border-gray-200 bg-[#F8FAFC] shadow-sm shadow-gray-900/[0.02]">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>模型配置</span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
          已固定
          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
        </span>
      </summary>

      <dl className="space-y-1.5 border-t border-gray-200 px-4 pb-3 pt-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold text-gray-500">中转服务</dt>
          <dd className="font-medium text-gray-900">{FIXED_RELAY_SERVICE_NAME}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold text-gray-500">GPT 分析模型</dt>
          <dd className="font-mono text-gray-900">{FIXED_GPT_MODEL}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold text-gray-500">生图模型</dt>
          <dd className="max-w-[280px] truncate font-mono text-gray-900" title={FIXED_IMAGE_MODEL.model}>
            {FIXED_IMAGE_MODEL.model}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function FixedImageModelRow() {
  return (
    <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] px-3 py-2">
      <div className="text-xs font-semibold text-gray-500">生图模型</div>
      <div className="mt-1 break-all font-mono text-xs font-semibold text-gray-900">
        {FIXED_IMAGE_MODEL.model}
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
    <section className="flex h-full min-h-[calc(100vh-112px)] flex-col rounded-[20px] border border-gray-200 bg-white p-6 shadow-sm">
      <PanelTitle />

      <div className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5">
          <SettingsGroup title="妆容控制">
            <SettingRow label="妆容强度">
              <SegmentedControl
                options={intensityOptions}
                value={settings.intensity}
                columnCount={3}
                onChange={(intensity) => onSettingsChange({ ...settings, intensity })}
              />
            </SettingRow>
            <SettingRow label="修改范围">
              <SegmentedControl
                options={scopeOptions}
                value={settings.scope}
                columnCount={5}
                onChange={(scope) => onSettingsChange({ ...settings, scope })}
              />
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup title="输出设置">
            <SettingRow label="输出数量">
              <SegmentedControl
                options={outputOptions}
                value={settings.outputCount}
                columnCount={3}
                onChange={(outputCount) => onSettingsChange({ ...settings, outputCount })}
              />
            </SettingRow>
            <SettingRow label="输出分辨率">
              <SegmentedControl
                options={outputResolutionOptions}
                value={settings.outputResolution}
                columnCount={2}
                onChange={(outputResolution) => onSettingsChange({ ...settings, outputResolution })}
              />
            </SettingRow>
            <SettingRow label="输出比例">
              <SegmentedControl
                options={outputAspectRatioOptions}
                value={settings.outputAspectRatio}
                columnCount={4}
                onChange={(outputAspectRatio) => onSettingsChange({ ...settings, outputAspectRatio })}
              />
            </SettingRow>
            <SettingRow label="保留程度">
              <SegmentedControl
                options={preservationOptions}
                value={settings.preservation}
                columnCount={3}
                onChange={(preservation) => onSettingsChange({ ...settings, preservation })}
              />
            </SettingRow>
          </SettingsGroup>

          <FixedImageModelRow />

          {settings.outputResolution === "2K" || settings.outputCount !== 1 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              线上生成可能较慢，建议先用 1K / 1 张测试；稳定后再尝试 2K 或多张输出。
            </div>
          ) : null}

          <FixedModelDetails />
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4F63FF] via-[#6D5DF6] to-[#3B82F6] px-5 text-sm font-semibold text-white shadow-lg shadow-[#6D5DF6]/20 transition hover:opacity-95 disabled:opacity-70"
          >
            <Sparkles className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "生成中..." : "开始生成妆容"}
          </button>
        </div>
      </div>
    </section>
  );
}
