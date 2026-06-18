"use client";

import { Download, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import type { AnalyzeApiError } from "@/lib/analyzeErrors";
import type { MockResult } from "@/lib/mock";
import type { MakeupAnalysisResult } from "@/lib/promptBuilder";

type LoadingAction = "analyze" | "generate" | "regenerate" | "refine" | null;

type ResultPanelProps = {
  results: MockResult[];
  loadingAction: LoadingAction;
  analysis: MakeupAnalysisResult | null;
  analysisError: AnalyzeApiError | null;
  refinePrompt: string;
  downloadLoadingId: string | null;
  onRefinePromptChange: (value: string) => void;
  onRegenerate: () => void;
  onRefine: () => void;
  onUseMockFallback: () => void;
  onDownload: (result: MockResult) => void;
};

function EmptyState() {
  return (
    <div className="grid min-h-[410px] place-items-center rounded-2xl border border-dashed border-app-border bg-[#FAFBFF] p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#F4F6FF] text-app-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-app-text">等待生成结果</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-app-muted">
          上传图片并点击生成后，结果会显示在这里。
        </p>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[410px] place-items-center rounded-2xl border border-app-border bg-[#FAFBFF] p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-app-primary shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-app-text">{label}</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-app-muted">
          请保持页面打开，生成完成后真实结果图会显示在这里。
        </p>
      </div>
    </div>
  );
}

function PromptPreview({ analysis }: { analysis: MakeupAnalysisResult }) {
  const reference = analysis.makeup_reference_analysis;

  return (
    <details className="rounded-2xl border border-app-border bg-[#FAFBFF] p-4 open:bg-white">
      <summary className="cursor-pointer select-none text-sm font-semibold text-app-text">
        AI 提示词预览
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-app-muted">
            Nano Banana 2 Prompt
          </div>
          <div className="mt-2 rounded-xl border border-app-border bg-white p-3 text-xs leading-5 text-app-text">
            {analysis.nano_prompt_en}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-app-muted">
            Negative Prompt
          </div>
          <div className="mt-2 rounded-xl border border-app-border bg-white p-3 text-xs leading-5 text-app-text">
            {analysis.negative_prompt_en}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-app-muted">原图保留重点</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {analysis.original_image_analysis.must_keep.map((item) => (
              <span
                key={item}
                className="rounded-full border border-app-border bg-white px-3 py-1 text-xs font-medium text-app-text"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-app-muted">妆容参考分析</div>
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
              <div key={label} className="rounded-xl border border-app-border bg-white p-3">
                <dt className="font-semibold text-app-muted">{label}</dt>
                <dd className="mt-1 leading-5 text-app-text">{value}</dd>
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
        {isProhibitedContent
          ? "模型安全策略拒绝了这次生图。可以尝试："
          : error.message}
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

export function ResultPanel({
  results,
  loadingAction,
  analysis,
  analysisError,
  refinePrompt,
  downloadLoadingId,
  onRefinePromptChange,
  onRegenerate,
  onRefine,
  onUseMockFallback,
  onDownload
}: ResultPanelProps) {
  const isBusy = loadingAction !== null;

  return (
    <section className="flex min-h-[calc(100vh-112px)] flex-col rounded-2xl border border-app-border bg-app-card p-5 shadow-card">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-app-text">结果预览</h2>
          <p className="mt-1 text-sm text-app-muted">
            展示 Nano Banana 2 生成图和后续优化入口。
          </p>
        </div>
        {results.length > 0 ? (
          <span className="rounded-full bg-[#F4F6FF] px-3 py-1.5 text-xs font-semibold text-app-primary">
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
                  ? "Nano Banana 2 正在重新生成图片..."
                  : loadingAction === "generate"
                    ? "Nano Banana 2 正在生成图片..."
                    : "GPT-5.5 正在分析妆容..."
            }
          />
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {results.map((result, index) => {
              const isDownloading = downloadLoadingId === result.id;

              return (
                <article
                  key={result.id}
                  className="overflow-hidden rounded-2xl border border-app-border bg-white"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-t-2xl bg-[#F3F4F8]">
                    <img
                      src={result.imageUrl}
                      alt={result.label}
                      className="h-full w-full object-contain"
                    />
                    {result.accent ? (
                      <div className={`absolute inset-0 bg-gradient-to-br ${result.accent}`} />
                    ) : null}
                    <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-app-primary shadow-sm backdrop-blur">
                      {result.isMock ? "Mock 预览" : "已生成"}
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-app-text">
                        {result.isMock ? result.label : `生成结果 ${index + 1}`}
                      </div>
                      <div className="text-xs text-app-muted">{result.generatedAt}</div>
                    </div>

                    {(result.outputResolution || result.originalAspect) && !result.isMock ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-[#F8FAFF] px-3 py-2">
                          <div className="font-semibold text-app-muted">输出分辨率</div>
                          <div className="mt-1 text-app-text">{result.outputResolution ?? "1K"}</div>
                        </div>
                        <div className="rounded-xl bg-[#F8FAFF] px-3 py-2">
                          <div className="font-semibold text-app-muted">原图比例</div>
                          <div className="mt-1 text-app-text">
                            {result.originalAspect ?? "unknown"}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onDownload(result)}
                      disabled={isDownloading || isBusy}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-semibold text-app-text transition hover:border-app-primary/50 hover:text-app-primary disabled:opacity-60"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {isDownloading ? "下载中..." : "下载"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4 border-t border-app-border pt-5">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isBusy || results.length === 0}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-semibold text-app-text transition hover:border-app-primary/50 hover:text-app-primary disabled:opacity-60"
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
          placeholder="例如：眼影更明显一点，嘴唇更透亮，不要改变原来的脸型"
          rows={4}
          className="w-full resize-none rounded-2xl border border-app-border bg-white px-4 py-3 text-sm leading-6 text-app-text outline-none transition placeholder:text-app-muted focus:border-app-primary focus:ring-4 focus:ring-app-primary/10"
        />

        <button
          type="button"
          onClick={onRefine}
          disabled={isBusy || results.length === 0}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-app-primary to-app-blue px-4 text-sm font-semibold text-white shadow-lg shadow-app-primary/15 transition hover:opacity-95 disabled:opacity-60"
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
