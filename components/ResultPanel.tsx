"use client";

import { useState } from "react";
import { Download, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import type { AnalyzeApiError } from "@/lib/analyzeErrors";
import type { EnhanceStrength, MockResult } from "@/lib/mock";
import type { MakeupAnalysisResult } from "@/lib/promptBuilder";

type LoadingAction = "analyze" | "generate" | "regenerate" | "refine" | null;

type ResultPanelProps = {
  results: MockResult[];
  loadingAction: LoadingAction;
  analysis: MakeupAnalysisResult | null;
  analysisError: AnalyzeApiError | null;
  refinePrompt: string;
  downloadLoadingId: string | null;
  enhanceLoadingId: string | null;
  onRefinePromptChange: (value: string) => void;
  onRegenerate: () => void;
  onRefine: () => void;
  onUseMockFallback: () => void;
  onEnhance: (result: MockResult, strength: EnhanceStrength) => void;
  onDownload: (result: MockResult) => void;
};

const enhanceStrengthOptions: Array<{ label: string; value: EnhanceStrength }> = [
  { label: "轻度增强", value: "light" },
  { label: "标准增强", value: "standard" },
  { label: "强力增强", value: "strong" }
];

const enhanceStrengthLabels: Record<EnhanceStrength, string> = {
  light: "轻度增强",
  standard: "标准增强",
  strong: "强力增强"
};

function EmptyState() {
  return (
    <div className="grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-gray-200 bg-[#F8FAFC] p-8 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-[#6D5DF6] shadow-sm ring-1 ring-gray-100">
          <Sparkles className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-sm font-semibold text-gray-900">等待生成结果</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-gray-500">
          上传图片并点击生成后，结果会显示在这里。
        </p>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[460px] place-items-center rounded-2xl border border-gray-200 bg-[#F8FAFC] p-8 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-[#6D5DF6] shadow-sm ring-1 ring-gray-100">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <h3 className="mt-5 text-sm font-semibold text-gray-900">{label}</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-gray-500">
          请保持页面打开，完成后结果会显示在这里。
        </p>
      </div>
    </div>
  );
}

function PromptPreview({ analysis }: { analysis: MakeupAnalysisResult }) {
  const reference = analysis.makeup_reference_analysis;

  return (
    <details className="rounded-2xl border border-gray-200 bg-[#F8FAFC] p-4 open:bg-white">
      <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900">
        AI 提示词预览
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
            Nano Banana 2 Prompt
          </div>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-900">
            {analysis.nano_prompt_en}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
            Negative Prompt
          </div>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-900">
            {analysis.negative_prompt_en}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500">原图保留重点</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {analysis.original_image_analysis.must_keep.map((item) => (
              <span
                key={item}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-900"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500">妆容参考分析</div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {[
              ["Eyeshadow", reference.eyeshadow],
              ["Eyeliner", reference.eyeliner],
              ["Eyelashes", reference.eyelashes],
              ["Brows", reference.brows],
              ["Blush", reference.blush],
              ["Lip Color", reference.lip_color],
              ["Lip Texture", reference.lip_texture],
              ["Highlight", reference.highlight],
              ["Eye Color", reference.eye_color],
              ["Accessory", reference.gem_or_accessory_color],
              ["Mood", reference.overall_makeup_mood]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
                <dt className="font-semibold text-gray-500">{label}</dt>
                <dd className="mt-1 leading-5 text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </details>
  );
}

function AnalyzeErrorCard({
  error,
  onUseMockFallback
}: {
  error: AnalyzeApiError;
  onUseMockFallback: () => void;
}) {
  const isProhibitedContent = error.code === "IMAGE_PROHIBITED_CONTENT";
  const canUseMockFallback =
    error.code.startsWith("GOOGLE") ||
    error.code.startsWith("BANANA") ||
    error.code.startsWith("IMAGE") ||
    error.code === "NANO_BANANA_NO_IMAGE";

  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">
        {isProhibitedContent ? "模型安全策略拒绝了这次生图。可以尝试：" : error.message}
      </div>
      {isProhibitedContent ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
          <li>换一张更完整、更少裸露肩颈的原图</li>
          <li>只选择“眼妆”或“腮红”</li>
          <li>使用轻度妆容</li>
          <li>裁掉肩膀以下区域，只保留脸部和头发</li>
          <li>重新生成</li>
        </ul>
      ) : null}
      <div className="mt-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 font-mono text-xs font-semibold text-red-700">
        {error.code}
      </div>
      {error.debug ? (
        <details className="mt-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-red-700">
            展开 debug
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-red-100 bg-white p-3 text-xs leading-5 text-red-900">
            {error.debug}
          </pre>
        </details>
      ) : null}
      {canUseMockFallback ? (
        <button
          type="button"
          onClick={onUseMockFallback}
          className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
        >
          使用 mock 结果预览
        </button>
      ) : null}
    </div>
  );
}

function formatOutputAspectRatio(result: MockResult) {
  if (!result.outputAspectRatio) {
    return result.resolvedAspectRatio ?? "1:1";
  }

  if (result.outputAspectRatio === "original") {
    return `原图比例（映射为 ${result.resolvedAspectRatio ?? "1:1"}）`;
  }

  return result.outputAspectRatio;
}

export function ResultPanel({
  results,
  loadingAction,
  analysis,
  analysisError,
  refinePrompt,
  downloadLoadingId,
  enhanceLoadingId,
  onRefinePromptChange,
  onRegenerate,
  onRefine,
  onUseMockFallback,
  onEnhance,
  onDownload
}: ResultPanelProps) {
  const [expandedEnhanceId, setExpandedEnhanceId] = useState<string | null>(null);
  const isBusy = loadingAction !== null;

  return (
    <section className="flex h-full min-h-[calc(100vh-112px)] flex-col rounded-[20px] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6D5DF6] text-sm font-bold text-white shadow-sm shadow-[#6D5DF6]/25">
            3
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">结果预览</h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">
              查看生成结果、下载图片或继续优化。
            </p>
          </div>
        </div>
        {results.length > 0 ? (
          <span className="rounded-full bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#6D5DF6]">
            {results.length} 张
          </span>
        ) : null}
      </div>

      <div className="flex-1">
        {analysisError ? (
          <AnalyzeErrorCard error={analysisError} onUseMockFallback={onUseMockFallback} />
        ) : null}

        {loadingAction ? (
          <LoadingState
            label={
              loadingAction === "refine"
                ? "继续优化生成中..."
                : loadingAction === "regenerate"
                  ? "正在重新生成图片..."
                  : loadingAction === "generate"
                    ? "正在生成图片..."
                    : "GPT-5.5 正在分析妆容..."
            }
          />
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {results.map((result, index) => {
              const isDownloading = downloadLoadingId === result.id;
              const isEnhancing = enhanceLoadingId === result.id;
              const canEnhance = !result.isMock && !result.isEnhanced;
              const generatedNumber = results
                .slice(0, index + 1)
                .filter((item) => !item.isMock && !item.isEnhanced).length;
              const title =
                result.isMock || result.isEnhanced ? result.label : `生成结果 ${generatedNumber}`;

              return (
                <article
                  key={result.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-t-2xl bg-[#F8FAFC]">
                    <img
                      src={result.imageUrl}
                      alt={title}
                      className="h-full w-full object-contain"
                    />
                    {result.accent ? (
                      <div className={`absolute inset-0 bg-gradient-to-br ${result.accent}`} />
                    ) : null}
                    <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-[#6D5DF6] shadow-sm backdrop-blur">
                      {result.isMock ? "Mock 预览" : result.isEnhanced ? "增强结果" : "已生成"}
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
                      <div className="text-xs text-gray-500">{result.generatedAt}</div>
                    </div>

                    {(result.outputResolution || result.outputAspectRatio || result.enhanceStrength) &&
                    !result.isMock ? (
                      <div className="space-y-0.5 text-xs leading-5 text-gray-500">
                        <p className="truncate">
                          {result.isEnhanced && result.enhanceStrength
                            ? `增强强度：${enhanceStrengthLabels[result.enhanceStrength]}`
                            : `输出：${result.outputResolution ?? "1K"} · ${formatOutputAspectRatio(result)}`}
                        </p>
                      </div>
                    ) : null}

                    <div className={canEnhance ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
                      <button
                        type="button"
                        onClick={() => onDownload(result)}
                        disabled={isDownloading || isBusy || isEnhancing}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6] disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {isDownloading ? "下载中..." : "下载"}
                      </button>

                      {canEnhance ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEnhanceId((currentId) =>
                                currentId === result.id ? null : result.id
                              )
                            }
                            disabled={isBusy || Boolean(enhanceLoadingId)}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-3 text-sm font-semibold text-white shadow-sm shadow-[#6D5DF6]/15 transition hover:opacity-95 disabled:opacity-60"
                          >
                            {isEnhancing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {isEnhancing ? "增强中..." : "画质增强"}
                          </button>

                          {expandedEnhanceId === result.id ? (
                            <div className="absolute bottom-[calc(100%+8px)] right-0 z-20 w-40 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-gray-900/10">
                              <div className="px-2 pb-1 text-xs font-semibold text-gray-500">
                                选择增强强度
                              </div>
                              <div className="space-y-1">
                                {enhanceStrengthOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setExpandedEnhanceId(null);
                                      onEnhance(result, option.value);
                                    }}
                                    disabled={isBusy || Boolean(enhanceLoadingId)}
                                    className="flex h-9 w-full items-center rounded-xl px-2 text-left text-xs font-semibold text-gray-600 transition hover:bg-[#F8FAFC] hover:text-[#6D5DF6] disabled:opacity-60"
                                  >
                                    {isEnhancing ? "处理中..." : option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4 border-t border-gray-200 pt-5">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isBusy || results.length === 0}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 transition hover:border-[#6D5DF6]/50 hover:text-[#6D5DF6] disabled:opacity-60"
        >
          {loadingAction === "regenerate" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loadingAction === "regenerate" ? "重新生成中..." : "重新生成"}
        </button>

        {analysis ? <PromptPreview analysis={analysis} /> : null}

        <textarea
          value={refinePrompt}
          onChange={(event) => onRefinePromptChange(event.target.value)}
          placeholder="例如：眼影更明显一点，嘴唇更通透，不要改变原来的脸型"
          rows={4}
          className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#6D5DF6] focus:ring-4 focus:ring-[#6D5DF6]/10"
        />

        <button
          type="button"
          onClick={onRefine}
          disabled={isBusy || results.length === 0}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6D5DF6] to-[#3B82F6] px-4 text-sm font-semibold text-white shadow-lg shadow-[#6D5DF6]/15 transition hover:opacity-95 disabled:opacity-60"
        >
          {loadingAction === "refine" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {loadingAction === "refine" ? "继续优化中..." : "继续优化生成"}
        </button>
      </div>
    </section>
  );
}
