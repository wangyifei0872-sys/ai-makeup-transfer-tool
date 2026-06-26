"use client";

import { useEffect, useRef, useState } from "react";
import { ApiKeySettingsModal } from "@/components/ApiKeySettingsModal";
import { ControlPanel } from "@/components/ControlPanel";
import { Header } from "@/components/Header";
import { ResultPanel } from "@/components/ResultPanel";
import { UploadPanel } from "@/components/UploadPanel";
import { getStoredApiKeys, hasRequiredKeys } from "@/lib/apiKeys";
import {
  createMockResults,
  type GenerationSettings,
  type MockResult,
  type OriginalAspect,
  type OutputResolution,
  type UploadedImage
} from "@/lib/mock";
import type { AnalyzeApiError } from "@/lib/analyzeErrors";
import type { MakeupAnalysisResult } from "@/lib/promptBuilder";

type UploadFieldKey = "source" | "reference" | "mask";
type LoadingAction = "analyze" | "generate" | "regenerate" | "refine" | null;

type GenerateImageResponse = {
  id: string;
  dataUrl: string;
  mimeType: string;
  outputResolution?: OutputResolution;
  originalAspect?: OriginalAspect;
};

type GenerateApiResponse =
  | { ok: true; images: GenerateImageResponse[] }
  | { ok: false; error: AnalyzeApiError | string };

type AnalyzeApiResponse =
  | { ok: true; analysis: MakeupAnalysisResult }
  | { ok: false; error: AnalyzeApiError | string };

const initialSettings: GenerationSettings = {
  intensity: "medium",
  scope: "full-face",
  preservation: "strict",
  outputCount: 1,
  outputResolution: "1K"
};

function createUploadedImage(file: File): UploadedImage {
  return {
    file,
    fileName: file.name,
    url: URL.createObjectURL(file)
  };
}

function readImageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };
    image.onerror = () => reject(new Error("Unable to read image dimensions."));
    image.src = url;
  });
}

function mapEditScope(scope: GenerationSettings["scope"]) {
  const scopeMap = {
    "full-face": "fullFace",
    eyes: "eyes",
    lips: "lips",
    blush: "blush",
    highlight: "highlight"
  } as const;

  return scopeMap[scope];
}

function mapPreservationLevel(preservation: GenerationSettings["preservation"]) {
  const preservationMap = {
    strict: "strict",
    normal: "normal",
    "soft-optimize": "softEnhance"
  } as const;

  return preservationMap[preservation];
}

function createGeneratedResults(images: GenerateImageResponse[], generationIndex: number): MockResult[] {
  return images.map((image, index) => ({
    id: `${image.id}-${generationIndex}-${Date.now()}`,
    imageUrl: image.dataUrl,
    label: `生成结果 ${index + 1}`,
    generatedAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    outputResolution: image.outputResolution,
    originalAspect: image.originalAspect
  }));
}

async function parseApiJsonResponse<T>(
  response: Response,
  routePath: string,
  fallbackCode: AnalyzeApiError["code"]
): Promise<T | { ok: false; error: AnalyzeApiError }> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: {
        code: fallbackCode,
        message: `${routePath} 返回了非 JSON 响应，可能是线上 API 超时或 Vercel 函数报错。`,
        debug: [
          `HTTP status: ${response.status}`,
          `Content-Type: ${response.headers.get("content-type") ?? "(empty)"}`,
          `Response preview: ${text.slice(0, 500)}`
        ].join("\n")
      }
    };
  }
}

export default function Home() {
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null);
  const [maskImage, setMaskImage] = useState<UploadedImage | null>(null);
  const [settings, setSettings] = useState<GenerationSettings>(initialSettings);
  const [results, setResults] = useState<MockResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<AnalyzeApiError | null>(null);
  const [analysis, setAnalysis] = useState<MakeupAnalysisResult | null>(null);
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyModalMessage, setApiKeyModalMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [downloadLoadingId, setDownloadLoadingId] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [generationIndex, setGenerationIndex] = useState(0);
  const latestImageUrlsRef = useRef<string[]>([]);

  latestImageUrlsRef.current = [sourceImage?.url, referenceImage?.url, maskImage?.url].filter(
    Boolean
  ) as string[];

  useEffect(() => {
    setApiKeysConfigured(hasRequiredKeys());

    return () => {
      latestImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const replaceImage = (
    setter: (image: UploadedImage | null) => void,
    currentImage: UploadedImage | null,
    nextImage: UploadedImage | null
  ) => {
    if (currentImage) {
      URL.revokeObjectURL(currentImage.url);
    }
    setter(nextImage);
  };

  const handleUpload = (key: UploadFieldKey, file: File) => {
    const uploadedImage = createUploadedImage(file);

    if (key === "source") {
      replaceImage(setSourceImage, sourceImage, uploadedImage);
      setResults([]);
      setAnalysis(null);
      readImageDimensions(uploadedImage.url)
        .then((dimensions) => {
          setSourceImage((currentImage) =>
            currentImage?.url === uploadedImage.url
              ? {
                  ...currentImage,
                  dimensions
                }
              : currentImage
          );
        })
        .catch(() => {
          setSourceImage((currentImage) =>
            currentImage?.url === uploadedImage.url
              ? {
                  ...currentImage,
                  dimensionsError: true
                }
              : currentImage
          );
        });
    }

    if (key === "reference") {
      replaceImage(setReferenceImage, referenceImage, uploadedImage);
      setResults([]);
      setAnalysis(null);
    }

    if (key === "mask") {
      replaceImage(setMaskImage, maskImage, uploadedImage);
    }

    setError(null);
    setAnalysisError(null);
  };

  const handleRemove = (key: UploadFieldKey) => {
    if (key === "source") {
      replaceImage(setSourceImage, sourceImage, null);
      setResults([]);
      setAnalysis(null);
    }

    if (key === "reference") {
      replaceImage(setReferenceImage, referenceImage, null);
      setResults([]);
      setAnalysis(null);
    }

    if (key === "mask") {
      replaceImage(setMaskImage, maskImage, null);
    }
  };

  const useMockResults = () => {
    if (!sourceImage) {
      return;
    }

    setGenerationIndex((currentIndex) => {
      const nextIndex = currentIndex + 1;
      setResults(createMockResults(sourceImage, settings.outputCount, nextIndex));
      return nextIndex;
    });
    setLoadingAction(null);
  };

  const runGeneration = async (action: "generate" | "regenerate") => {
    if (!sourceImage || !referenceImage) {
      setError("请先上传原始插画和妆容参考图。");
      return;
    }

    const { relayApiKey } = getStoredApiKeys();

    if (!relayApiKey.trim()) {
      setApiKeyModalMessage("请先填写 API Key，用于调用模型。");
      setApiKeyModalOpen(true);
      setApiKeysConfigured(false);
      return;
    }

    setError(null);
    setAnalysisError(null);

    try {
      let activeAnalysis = action === "regenerate" ? analysis : null;

      if (!activeAnalysis) {
        setLoadingAction("analyze");
        const analyzeFormData = new FormData();
        analyzeFormData.append("originalImage", sourceImage.file);
        analyzeFormData.append("referenceImage", referenceImage.file);
        analyzeFormData.append("makeupIntensity", settings.intensity);
        analyzeFormData.append("editAreas", mapEditScope(settings.scope));
        analyzeFormData.append("preserveLevel", mapPreservationLevel(settings.preservation));
        analyzeFormData.append("outputCount", String(settings.outputCount));
        analyzeFormData.append("outputResolution", settings.outputResolution);
        analyzeFormData.append("relayApiKey", relayApiKey);

        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          body: analyzeFormData
        });
        const analyzeData = await parseApiJsonResponse<AnalyzeApiResponse>(
          analyzeResponse,
          "/api/analyze",
          "OPENAI_API_ERROR"
        );

        if (!analyzeResponse.ok || !analyzeData.ok) {
          if (!analyzeData.ok && typeof analyzeData.error === "object") {
            setAnalysisError(analyzeData.error);
            return;
          }

          throw new Error(
            !analyzeData.ok && typeof analyzeData.error === "string"
              ? analyzeData.error
              : "GPT 分析失败。"
          );
        }

        activeAnalysis = analyzeData.analysis;
        setAnalysis(activeAnalysis);
      }

      setLoadingAction(action === "regenerate" ? "regenerate" : "generate");
      const generateFormData = new FormData();
      generateFormData.append("originalImage", sourceImage.file);
      generateFormData.append("referenceImage", referenceImage.file);
      generateFormData.append("nanoPrompt", activeAnalysis.nano_prompt_en);
      generateFormData.append("negativePrompt", activeAnalysis.negative_prompt_en);
      generateFormData.append("makeupIntensity", settings.intensity);
      generateFormData.append("editArea", mapEditScope(settings.scope));
      generateFormData.append("preserveLevel", mapPreservationLevel(settings.preservation));
      generateFormData.append("outputCount", String(settings.outputCount));
      generateFormData.append("outputResolution", settings.outputResolution);
      generateFormData.append("relayApiKey", relayApiKey);

      const generateResponse = await fetch("/api/generate", {
        method: "POST",
        body: generateFormData
      });
      const generateData = await parseApiJsonResponse<GenerateApiResponse>(
        generateResponse,
        "/api/generate",
        "GENERATE_API_ERROR"
      );

      if (!generateResponse.ok || !generateData.ok) {
        if (!generateData.ok && typeof generateData.error === "object") {
          setAnalysisError(generateData.error);
          return;
        }

        throw new Error(
          !generateData.ok && typeof generateData.error === "string"
            ? generateData.error
            : "生图失败。"
        );
      }

      setGenerationIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;
        setResults(createGeneratedResults(generateData.images, nextIndex));
        return nextIndex;
      });
    } catch (apiError) {
      const rawMessage = apiError instanceof Error ? apiError.message : "生成失败，请稍后重试。";
      const message =
        /failed to fetch|networkerror|load failed/i.test(rawMessage)
          ? "请求没有收到后端结构化响应，可能是线上 API 超时、网络中断或 Vercel 函数被提前终止。请先选择 1K、输出 1 张，并上传更小的图片重试。"
          : rawMessage;
      setAnalysisError({
        code: "BANANA_RELAY_CONNECTION_FAILED",
        message,
        debug: `Frontend fetch or response parsing failed before receiving a structured API error. Raw error: ${rawMessage}`
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefine = () => {
    setAnalysisError({
      code: "GENERATE_REQUEST_INVALID",
      message: "继续优化功能将在下一阶段接入。",
      debug: "Refine generation is intentionally disabled in this stage."
    });
  };

  const handleDownload = (result: MockResult) => {
    setDownloadLoadingId(result.id);

    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = result.imageUrl;
      link.download = `${result.label.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloadLoadingId(null);
    }, 300);
  };

  return (
    <main className="min-h-screen bg-app-bg">
      <Header
        apiKeysConfigured={apiKeysConfigured}
        onOpenSettings={() => {
          setApiKeyModalMessage(null);
          setApiKeyModalOpen(true);
        }}
      />

      <ApiKeySettingsModal
        open={apiKeyModalOpen}
        message={apiKeyModalMessage}
        onClose={() => {
          setApiKeyModalOpen(false);
          setApiKeyModalMessage(null);
          setApiKeysConfigured(hasRequiredKeys());
        }}
        onSaved={() => {
          setApiKeyModalMessage(null);
          setApiKeysConfigured(hasRequiredKeys());
        }}
        onCleared={() => {
          setApiKeysConfigured(false);
        }}
      />

      <div className="mx-auto max-w-[1440px] px-8 py-6">
        <div className="grid grid-cols-[390px_420px_minmax(0,1fr)] items-start gap-6">
          <UploadPanel
            sourceImage={sourceImage}
            referenceImage={referenceImage}
            maskImage={maskImage}
            error={error}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
          <ControlPanel
            settings={settings}
            isGenerating={loadingAction !== null}
            onSettingsChange={setSettings}
            onGenerate={() => runGeneration("generate")}
          />
          <ResultPanel
            results={results}
            loadingAction={loadingAction}
            analysis={analysis}
            analysisError={analysisError}
            refinePrompt={refinePrompt}
            downloadLoadingId={downloadLoadingId}
            onRefinePromptChange={setRefinePrompt}
            onRegenerate={() => runGeneration("regenerate")}
            onRefine={handleRefine}
            onUseMockFallback={useMockResults}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </main>
  );
}
